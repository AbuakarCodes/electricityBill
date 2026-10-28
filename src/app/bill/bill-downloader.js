import { Utils } from "./utils.js"
import { Lesco } from "./lesco.js"

class BillDownloader {
  async start(ids) {
    try {
      const bills = await this.handleLescoBills(ids)
      return bills
    } catch (error) {
      console.log("Exception caught while fetching LESCO bills at BillDownloader.handleLescoBills", error)
      throw error
    }
  }

  async handleLescoBills(ids) {
    const lescoDownloader = new Lesco()
    const bills = []

    for (const id of ids) {
      // Bind preserves `this` so processId can access the lescoDownloader instance properties.
      const result = await Utils.safeExecute(lescoDownloader.processId.bind(lescoDownloader), id)

      if (result.success) {
        bills.push({
          id,
          bill: result.data,
        })
      } else {
        console.error(`Failed to fetch bill for customer ${id}:`, result.error)

        bills.push({
          id,
          error: result.error.message,
        })
      }
    }

  

    return bills
  }
}

export { BillDownloader }
