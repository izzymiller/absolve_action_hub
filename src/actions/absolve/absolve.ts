import * as Hub from "../../hub"

import * as absolve from "absolve"

const TAG = "carbon"

export class AbsolveAction extends Hub.Action {

  name = "absolve"
  label = "Absolve - Manage your Carbon Footprint"
  iconName = "absolve/leaf.svg"
  description = "Offset your carbon footprint from within Looker!"
  supportedActionTypes = [Hub.ActionType.Cell, Hub.ActionType.Query]
  supportedFormats = [Hub.ActionFormat.JsonDetail]
  requiredFields = [{ tag: TAG }]
  params = [
    {
      name: "publicKey",
      label: "Cloverly Public Key",
      required: true,
      sensitive: true,
      description: "Public Key from https://cloverly.com",
    }, {
      name: "privateKey",
      label: "Cloverly Private Key",
      required: false,
      sensitive: true,
      description: "Private Key from https://cloverly.com",
    }, {
      name: "autoBuy",
      label: "Auto Accept Offsets",
      required: true,
      sensitive: false,
      description: "Automatically accept any offset price estimate returned by Cloverly?",
    },
  ]

  async execute(request: Hub.ActionRequest) {

    if (!request.formParams.autoBuy) {
      throw "Must specify auto acceptance settings."
    }

    
    let footprint: number

    const value = Number(request.params.value)
    if (!value) {
      throw "Couldn't get data from cell."
    }
    footprint = value

    const client = this.absolveClientFromRequest(request)

    let response
    try {
      await Promise.all(footprint.map(async (to) => {
        const message = {
          from: request.params.from,
          to,
          body,
        }
        return client.messages.create(message)
      }))
    } catch (e) {
      response = {success: false, message: e.message}
    }

    return new Hub.ActionResponse(response)
  }

  async form() {
    const form = new Hub.ActionForm()
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
    }]
    return form
  }

  private absolveClientFromRequest(request: Hub.ActionRequest) {
    return absolve(request.params.publicKey, request.params.authToken)
  }

}

Hub.addAction(new AbsolveAction())
