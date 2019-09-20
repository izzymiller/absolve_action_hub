import * as Hub from "../../hub"
import * as httpRequest from "request-promise-native"

const CL_API_URL = "https://api.cloverly.app/2019-03-beta"
const TAG = "co2_footprint"

export class absolveAction extends Hub.Action {
  name = "absolve"
  label = "Purchase carbon offsets"
  iconName = "absolve/leaf.svg"
  description = "Offset your carbon footprint"
  supportedActionTypes = [Hub.ActionType.Cell,Hub.ActionType.Dashboard]
  requiredFields = [{tag: TAG}]
  params = [
    {
      name: "privateKey",
      label: "Cloverly API Private Key",
      description: "API Token from https://dashboard.cloverly.app/dashboard",
      required: true,
      sensitive: true,
    },
    {
      name: "use_full_data_pipeline",
      label: "Use data pipeline to push purchased offset data back into a BigQuery connection",
      description: "Select Yes to use the full data pipeline included. Requires setup per: README.MD",
      required: true,
      type: "select",
      sensitive: false,
      options: [
        {name: "no", label: "No"},
        {name: "yes", label: "Yes"},
      ],
      default: "yes",
    },
    {
      name: "bucketName",
      label: "GCS Bucket Name- Optional",
      description: "Only required if you are using the full data pipeline",
      required: false,
      default: "absolve_bucket",
      sensitive: false,
    },
    {
      name: "datasetId",
      label: "BQ DatasetID- Optional",
      description: "Only required if you are using the full data pipeline",
      required: false,
      default: "carbon_offsets",
      sensitive: false,
    },
    {
      name: "tableId",
      label: "BQ Table Name",
      description: "Only required if you are using the full data pipeline",
      required: false,
      default: "offset_purchases",
      sensitive: false,
    },
  ]

  async execute(request: Hub.ActionRequest) {
    var tgm = Number(undefined)
    var footprint = Number(undefined)
    var matchType = String(undefined)
    
    if(request.formParams.matchType) {
      matchType = request.formParams.matchType
    } else {
      matchType = ""
    }

    if(!request.params.value) {
      throw "Couldn't get data from cell."
    } else if(request.params.value.includes(',')) {
      footprint = Number(request.params.value.split(",")[0])
      console.log(`footprint has been set successfully: ${footprint}`)
      tgm = Number(request.params.value.split(",")[1])
      console.log(`TGM has been set successfully ${tgm}`)
    } else{
      footprint =  Number(request.params.value)
      console.log(`footprint has been set successfully: ${footprint}`)
      tgm = Number(undefined)
      console.log(`TGM has been set successfully: ${tgm}`)
    }

    if (request.formParams.useThreshold == "yes" && !request.formParams.costThreshold && !request.formParams.percentThreshold) {
      throw "Threshold use required, but no thresholds set!"
    }

    if (request.formParams.useThreshold == "yes" && request.formParams.percentThreshold && !tgm) {
      console.log("83 fail")
      throw "Percent Threshold set, but TGM is not included in query!"
    }

    ///Get an estimate to compare to our thresholds
    var estimate_options = {
      url: `${CL_API_URL}/estimates/carbon/`,
      headers: {
       'Content-type': 'application/json',
       'Authorization': `Bearer private_key:${request.params.privateKey}`,
      },
      json: true,
      resolveWithFullResponse: true,
      body: {'weight':{'value':footprint,'units':'kg'},"offset_match":{"type":matchType}},
    }

    try {
      const response = await httpRequest.post(estimate_options).promise()
      let estimateCost = parseInt(response.body.total_cost_in_usd_cents)/100
      let estimateSlug = response.body.slug
      console.log(`Estimate successfully returned: ${estimateCost}`)
      
      ///Takes the smallest threshold value and sets that as the maximum allowable offset cost
      var threshold = Number()
      if(request.formParams.costThreshold && request.formParams.percentThreshold) {
         threshold = Math.min(Number(request.formParams.costThreshold),(Number(request.formParams.percentThreshold)/100)*tgm)
      } else if(!request.formParams.costThreshold && request.formParams.percentThreshold) {
        threshold = (Number(request.formParams.percentThreshold)/100)*tgm
      } else if(request.formParams.costThreshold && !request.formParams.percentThreshold) {
        threshold = Number(request.formParams.costThreshold)
      } else if(!request.formParams.costThreshold && !request.formParams.percentThreshold) {
        threshold = Number(undefined)
      } else {
        threshold = Number(undefined)
        console.log("Unknown threshold issue")
      }
      console.log(`Threshold:${threshold}`)
      ///Check estimate against thresholds
      if (estimateCost <= threshold || request.formParams.useThresholds == "no") {

      ///If estimate is within bounds or thresholds do not apply, convert to purchase

        const purchase_options = {
          url: `${CL_API_URL}/purchases/`,
          headers: {
           'Content-type': 'application/json',
           'Authorization': `Bearer private_key:${request.params.privateKey}`,
          },
          json: true,
          resolveWithFullResponse: true,
          body: {'estimate_slug':estimateSlug},
        }

        try {
          const response = await httpRequest.post(purchase_options).promise()
          let cost = response.body.total_cost_in_usd_cents/100
          console.log(`You have successfully offset your footprint, spending $${cost}!`)


          ///If full pipeline is enabled, send a webhook to refresh the record in the offset database
          if(request.params.use_full_data_pipeline == "yes") {
            refresh_data(request.params.bucketName, request.params.datasetId, request.params.tableId)
            }
          return new Hub.ActionResponse({ success: true,message: response })
        } catch (e) {
          console.log("Failure with purchase execution")
          return new Hub.ActionResponse({ success: false, message: e.message })
        }

      ///If the estimate was higher than the threshold but alwaysBuy is on, spend the threshold.
      } else if( estimateCost > threshold && request.formParams.alwaysBuy == "yes") {
        threshold = Math.max(threshold,0.25)
        const purchase_options = {
          url: `${CL_API_URL}/purchases/currency`,
          headers: {
           'Content-type': 'application/json',
           'Authorization': `Bearer private_key:${request.params.privateKey}`,
          },
          json: true,
          resolveWithFullResponse: true,
          body: {'currency':{'value':threshold,'units':'usd'}},
        }
        ///Make the purchase
        try {
          const response = await httpRequest.post(purchase_options).promise()
          let cost = response.body.total_cost_in_usd_cents/100
          console.log(`You have successfully offset your footprint, spending $${cost}!`)
          
          ///If full pipeline is enabled, send a webhook to refresh the record in the offset database
          if(request.params.use_full_data_pipeline == "yes") {
            refresh_data(request.params.bucketName, request.params.datasetId, request.params.tableId)
          }
          return new Hub.ActionResponse({ success: true,message: response })
        } catch (e) {
          console.log("Failure with purchase execution")
          return new Hub.ActionResponse({ success: false, message: e.message })
        }
      } else {
        console.log(`Estimate for offset (${estimateCost}) was greater than threshold (${threshold}). Increase threshold or decrease offset quantity.`)
        return new Hub.ActionResponse({ success: false, message: `Estimate for offset (${estimateCost}) was greater than threshold (${threshold}). Increase threshold or decrease offset quantity.` })
      }
    ///Catch failures with the entire thing
    } catch (e) {
      console.log("Failure getting & checking estimate ")
      return new Hub.ActionResponse({ success: false, message: e.message })
    }
  }

  async form() {
    const form = new Hub.ActionForm()
    form.fields = [{
      label: "Use Thresholds?",
      name: "useThresholds",
      required: true,
      type: "select",
      options: [
        {name: "no", label: "No"},
        {name: "yes", label: "Yes"},
      ],
      default: "yes",
    },
    {
      label: "Purchase Threshold amount regardless of estimate",
      description: "This will ALWAYS result in a spend of at least $.25",
      name: "alwaysBuy",
      required: true,
      type: "select",
      options: [
        {name: "no", label: "No"},
        {name: "yes", label: "Yes"},
      ],
      default: "no",
    },
    {
      label: "Threshold: Percentage of Total Gross Margin (optional)",
      name: "percentThreshold",
      description: "Limits your offset cost at a percentage of the Total Gross Margin associated with the current grouping. Requires TGM field to be in-query",
      required: false,
      type: "string",
      default: "2"
    },
    {
     label: "Threshold: Manual Dollar Value (optional)",
      name: "costThreshold",
      description: "Limits your offset cost at the dollar value specified here. If set, overrides TGM threshold.",
      required: false,
      type: "string",
      default: "200",
    },
    {
      label: "Offset Type",
       name: "matchType",
       description: "Matches your purchased offsets to the type specified here. Recommended blank for best cost performance. (optional)",
       required: false,
       type: "select",
       options: [
        {name: "wind", label: "Wind"},
        {name: "solar", label: "Solar"},
        {name: "biomass", label: "Biomass"},
        {name: "wind", label: "Wind"},
      ],
       default: "",
     },
    ]
    return form
  }
}

async function refresh_data(bucketName: string | undefined , datasetId: string | undefined, tableId: string | undefined) {
  try {
    const refresh_options = {
      url: `https://us-central1-absolve.cloudfunctions.net/refresh_offset_data`,
      headers: {
      'Content-type': 'application/json',
      },
      json: true,
      resolveWithFullResponse: true,
      body: {'bucketName': bucketName,'datasetId': datasetId,'tableId': tableId},
    }
    await httpRequest.post(refresh_options).promise()
    console.log('Dataset refreshed successfully');
  } catch(err) {
    console.log('Error',err.message);
  }

}

Hub.addAction(new absolveAction())