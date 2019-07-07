import * as Hub from "../../hub"

import * as httpRequest from "request-promise-native"

const CL_API_URL = "https://api.cloverly.app/2019-03-beta"
const TAG = "co2_footprint"
export class absolveAction extends Hub.Action {

  name = "absolve"
  label = "Purchase carbon offsets"
  iconName = "absolve/leaf.svg"
  description = "Offset your carbon footprint"
  supportedActionTypes = [Hub.ActionType.Cell]
  requiredFields = [{tag: TAG}]
  params = [
    {
      name: "privateKey",
      label: "Cloverly API Private Key",
      description: "API Token from https://dashboard.cloverly.app/dashboard",
      required: true,
      sensitive: true,
    },
    //  {
    //   name: "autoBuy",
    //   label: "Auto Accept Offsets",
    //   required: true,
    //   sensitive: false,
    //   description: "Automatically accept any offset price estimate returned by Cloverly?",
    // },
  ]

  async execute(request: Hub.ActionRequest) {
    const footprint = Number(request.params.value)
    if (!footprint) {
      throw "Couldn't get data from cell."
    }

    if (request.formParams.useThreshold == "yes" && !request.formParams.costThreshold && !request.formParams.percentThreshold) {
      throw "Threshold use required, but no thresholds set!"
    }

    ///First get an estimate to compare to our thresholds
    const estimate_options = {
      url: `${CL_API_URL}/estimates/carbon/`,
      headers: {
       'Content-type': 'application/json',
       'Authorization': `Bearer private_key:${request.params.privateKey}`,
      },
      json: true,
      resolveWithFullResponse: true,
      body: {'weight':{'value':footprint,'units':'kg'}},
    }

    try {
      const response = await httpRequest.post(estimate_options).promise()
      let estimateCost = parseInt(response.body.total_cost_in_usd_cents)
      console.log("Estimate successfully returned:",estimateCost)
      
      ///Takes the smallest threshold value and sets that as the maximum allowable offset cost
      if (request.formParams.costThreshold && !request.formParams.percentThreshold) {
        var threshold = Number(request.formParams.costThreshold)
      } else if (!request.formParams.costThreshold && request.formParams.percentThreshold) {
        var threshold = Number(request.formParams.percentThreshold)*2000
      } else if (request.formParams.costThreshold && request.formParams.percentThreshold) {
        var threshold = Math.min(Number(request.formParams.costThreshold),(Number(request.formParams.percentThreshold)*2000))
      } else {
        var threshold = Number(undefined)
      }
      
      ///Check estimate against thresholds
      if (estimateCost < threshold || request.formParams.useThreshold == "no") {

      ///If estimate is within bounds, convert to purchase

        const purchase_options = {
          url: `${CL_API_URL}/purchases/carbon/`,
          headers: {
           'Content-type': 'application/json',
           'Authorization': `Bearer private_key:${request.params.privateKey}`,
          },
          json: true,
          resolveWithFullResponse: true,
          body: {'weight':{'value':footprint,'units':'kg'}},
        }
        ///Execute purchase
        try {
          const response = await httpRequest.post(purchase_options).promise()
          let cost = response.body.total_cost_in_usd_cents
          console.log("You have successfully offset your footprint, spending",cost,"!")
          return new Hub.ActionResponse({ success: true,message: response })
        } catch (e) {
          console.log("Failure with purchase execution")
          return new Hub.ActionResponse({ success: false, message: e.message })
        }
      ///If the estimate was not explicitly accepted, default to failure.
      } else {
        console.log("Estimate for offset was greater than threshold. Increase threshold or decrease offset quantity.")
        return new Hub.ActionResponse({ success: false, message: "Estimate for offset was greater than threshold. Increase threshold or decrease offset quantity." })
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
      name: "useThreshold",
      required: true,
      type: "select",
      options: [
        {name: "no", label: "No"},
        {name: "yes", label: "Yes"},
      ],
      default: "yes",
    },
    {
      label: "Threshold: Percentage of Total Gross Margin",
      name: "percentThreshold",
      description: "Limits your offset cost at a percentage of the Total Gross Margin associated with the current grouping. Requires TGM field to be in-query",
      required: false,
      type: "string",
      default: "2"
    },
    {
     label: "Threshold: Manual Dollar Value",
      name: "costThreshold",
      description: "Limits your offset cost at the dollar value specified here. If set, overrides TGM threshold.",
      required: false,
      type: "string",
      default: "",
    },
    {
      label: "Advanced: Offset Type",
       description: "Type of REC. Recommended left blank for optimal price matching.",
       name: "offsetType",
       required: false,
       type: "select",
       options: [
        {name: "wind", label: "Wind"},
        {name: "solar", label: "Solar"},
        {name: "biomass", label: "Biomass"},
        {name: "solar", label: "Solar"},
        {name: "", label: ""}
      ],
       default: "",
     },
    ]
    return form
  }
}

Hub.addAction(new absolveAction())