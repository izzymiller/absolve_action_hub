import * as chai from "chai"

import * as Hub from "../../hub"

import { absolveAction } from "./absolve"

const action = new absolveAction()

describe(`${action.constructor.name} unit tests`, () => {

  describe("form", () => {

    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })

    it("has form with url param", (done) => {
      const request = new Hub.ActionRequest()
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
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
          description: "Limit cost of the offset to a percentage of the Total Gross Margin of the record. Requires a TGM field present in the explore."
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
        ],
      }).and.notify(done)
    })

  })

})
