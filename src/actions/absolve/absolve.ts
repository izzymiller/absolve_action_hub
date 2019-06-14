import * as Hub from "../../hub"
import JSON

import * as httpRequest from "request-promise-native"

const CL_API_URL = "https://api.cloverly.app/2019-03-beta"

export class absolveAction extends Hub.Action {

  name = "absolve"
  label = "Absolve - Manage your Carbon Footprint"
  iconName = "absolve/leaf.svg"
  description = "Offset your Carbon Footprint"
  supportedActionTypes = [Hub.ActionType.Cell]
  params = [
    {
      name: "privateKey",
      label: "Cloverly API Private Key",
      description: "API Token from https://dashboard.cloverly.app/dashboard/",
      required: true,
      sensitive: true,
    }, {
      name: "autoBuy",
      label: "Auto Accept Offsets",
      required: true,
      sensitive: false,
      description: "Automatically accept any offset price estimate returned by Cloverly?",
    },
  ]

  async execute(request: Hub.ActionRequest) {
    console.log(request)
    console.log(request.params)
    const footprint = Number(request.params.value)
    if (!footprint) {
      throw "Couldn't get data from cell."
    }
    console.log(footprint)

    const options = {
      url: `${CL_API_URL}/purchases/carbon/`,
      headers: {
       'Content-type': 'application/json',
       'Authorization': `Bearer private_key:${request.params.privateKey}`,
      },
      json: true,
      resolveWithFullResponse: true,
      body: JSON.stringify({"weight":{"value":35,"units":"kg"}}),
    }

    try {
      const response = await httpRequest.post(options).promise()
      console.log(response)
      return new Hub.ActionResponse({ success: true,message: response })
    } catch (e) {
      return new Hub.ActionResponse({ success: false, message: e.message })
    }
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()

    if (!request.params.privateKey) {
      form.error = "No Cloverly API key configured. Please add it in the Admin > Actions panel."
      return form
    }

    try {
      await this.validateCloverlyToken(request.params.privateKey)

      form.fields = [{
        label: "Auto Accept Estimate?",
        name: "autoAccept",
        required: true,
        type: "select",
        options: [
            { name: "yes", label: "Yes" },
            { name: "no", label: "No" },
            { name: "yes_with_threshold", label: "Yes, with threshold" },
          ],
        default: "yes_with_threshold"
    },
    {
      label: "Cost Threshold ($)",
      name: "cost_threshold",
      required: false,
      type: "string",
      default: "5"
    },
      ]
    } catch (e) {
      form.error = this.prettyAbsolveError(e)
    }

    return form
  }

  private async validateCloverlyToken(token: string) {
    try {
      await httpRequest.get({
        url: `${CL_API_URL}/account`,
        headers: {
          Authorization: `Token ${token}`,
        },
        json: true,
      }).promise()
    } catch (e) {
      throw new Error("Invalid token")
    }
  }

  private prettyAbsolveError(e: Error) {
    if (e.message === "Invalid token") {
      return "Your Cloverly API token is invalid."
    }
    return e.message
  }
}

Hub.addAction(new absolveAction())