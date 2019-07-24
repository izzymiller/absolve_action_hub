import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../../src/hub"

import { absolveAction } from "./absolve"

const action = new absolveAction()

function expectAbsolveMatch(request: Hub.ActionRequest, match: any) {

  const createSpy = sinon.spy(async () => Promise.resolve())

  const stubClient = sinon.stub(action as any, "absolveClientFromRequest")
    .callsFake(() => ({
      messages: {create: createSpy},
    }))

  return chai.expect(action.execute(request)).to.be.fulfilled.then(() => {
    chai.expect(createSpy).to.have.been.calledWithMatch(match)
    stubClient.restore()
  })
}

describe(`${action.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if there is no co2 tag", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Cell
      request.params = {
        from: "fromphone",
      }
      request.formParams = {
        useThresholds: "yes",
        alwaysBuy: "no",
        costThreshold: "20",
      }

      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Query requires a field tagged co2_footprint.")
    })

    it("errors if there is no attachment for cell", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Cell
      request.params = {
        from: "fromphone",
      }
      request.formParams = {
        message: "My Message",
      }

      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Couldn't get data from cell.")
    })

    it("sends right params for cell", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Cell
      request.params = {
        from: "fromphone",
        value: "12122222222",
      }
      request.formParams = {
        message: "My Message",
      }
      return expectAbsolveMatch(request, {
        to: "12122222222",
        body: request.formParams.message,
        from: "fromphone",
      })
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })

  })

})