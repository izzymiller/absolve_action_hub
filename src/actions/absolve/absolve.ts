import * as Hub from "../../hub"

import * as httpRequest from "request-promise-native"

const CL_API_URL = "https://api.cloverly.app/2019-03-beta"
const TAG = "co2_footprint"
export class absolveAction extends Hub.Action {

  name = "absolve"
  label = "Absolve - Manage Your Carbon Footprint"
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

    if (!request.formParams.costThreshold) {
      throw "Must set a cost_threshold!"
    }

    if (footprint > Number(request.formParams.costThreshold)) {
      throw "Too Expensive! Increase your threshold or try another offset"
    }
    const options = {
      url: `${CL_API_URL}/purchases/carbon/`,
      headers: {
       'Content-type': 'application/json',
       'Authorization': `Bearer private_key:${request.params.privateKey}`,
      },
      json: true,
      resolveWithFullResponse: true,
      body: {'weight':{'value':footprint,'units':'pounds'}},
    }

    try {
      const response = await httpRequest.post(options).promise()
      let cost = response.body.rec_cost_in_usd_cents
      let receipt = response.body.pretty_url
      console.log(cost)
      console.log(receipt)
      console.log("You have successfully offset your footprint, spending ${cost}! See the details at ${receipt}.")
      return new Hub.ActionResponse({ success: true,message: response })
    } catch (e) {
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
      label: "Percentage Margin Threshold",
      name: "percentThreshold",
      required: false,
      type: "string",
      default: "2"
    },
    {
     label: "Manual Cost Threshold ($)",
      name: "costThreshold",
      required: false,
      type: "string",
      default: "",
    },
    {
      label: "Offset Type",
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