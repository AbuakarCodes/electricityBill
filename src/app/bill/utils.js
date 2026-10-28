import * as fs from "fs"
import * as util from "util"
import * as os from "node:os"
import { exec } from "child_process"
import * as Cheerio from "cheerio"
const execPromise = util.promisify(exec)
import { format } from "date-fns"
import { FormData } from "node-fetch"
import * as path from "path"
const DOWNLOADS_PATH = "downloads"
const DATA_PATH = "data"
const STATUS_FILE_PATH = `${DATA_PATH}/status.json`
const TMP_DIR = "tmp"

// safeExecute
// parseCookies
// parseBill
// mapToFormData

const Utils = {
  parseBill: (html) => {
    // 1. Validate input
    if (typeof html !== "string" || html.trim().length === 0) {
      throw new TypeError("parseBill: HTML must be a non-empty string.")
    }

    // 2. Parse HTML safely
    let $

    try {
      $ = Cheerio.load(html)
    } catch (error) {
      throw new Error("parseBill: Failed to parse bill HTML.", { cause: error })
    }

    // 3. Verify that this looks like a bill document
    if ($("body").length === 0 || $("p").length === 0) {
      throw new Error("parseBill: Invalid bill HTML; expected a document containing paragraph fields.")
    }

    // 4. Extract text indexed by its CSS coordinates
    const positions = new Map()

    $("p").each((_, element) => {
      const style = $(element).attr("style") || ""

      const topMatch = style.match(/(?:^|;)\s*top\s*:\s*(-?\d+(?:\.\d+)?)px/i)

      const leftMatch = style.match(/(?:^|;)\s*left\s*:\s*(-?\d+(?:\.\d+)?)px/i)

      // Ignore elements that do not use the expected positioning
      if (!topMatch || !leftMatch) return

      const top = Number(topMatch[1])
      const left = Number(leftMatch[1])

      if (!Number.isFinite(top) || !Number.isFinite(left)) {
        return
      }

      const key = `${top},${left}`
      const value = $(element).text().replace(/\s+/g, " ").trim()

      if (!value) return

      if (!positions.has(key)) {
        positions.set(key, [])
      }

      positions.get(key).push(value)
    })

    // 5. Read a field by its coordinates
    function get(top, left) {
      const values = positions.get(`${top},${left}`) || []

      if (values.length > 1) {
        throw new Error(`parseBill: Multiple values found at coordinates (${top}, ${left}).`)
      }

      return values[0] ?? ""
    }

    // 6. Extract and validate the meter image URL
    function getMeterImageUrl() {
      const image = $("#mtr1img")

      if (image.length === 0) {
        return ""
      }

      const src = image.attr("src")?.trim()

      if (!src) {
        return ""
      }

      try {
        const url = new URL(src)

        if (!["http:", "https:"].includes(url.protocol)) {
          throw new Error("Unsupported URL protocol.")
        }

        return url.href
      } catch {
        throw new Error("parseBill: The meter image contains an invalid URL.")
      }
    }

    // 7. Build the bill object
    const bill = {
      subdivisionCode: get(187, 60),
      referenceNumber: get(187, 230),
      customerId: get(228, 60),
      area: get(228, 230),
      town: get(275, 230),
      connectionType: get(275, 385),
      tariff: get(275, 530),

      customerName: get(295, 50),
      address: get(310, 50),

      meter: {
        previousReading: get(415, 115),
        currentReading: get(415, 325),
        unitsConsumed: get(415, 535),
        meterNumber: get(512, 105),
        meterImage: getMeterImageUrl(),
      },

      billMonth: get(215, 700),
      readingDate: get(275, 635),
      issueDate: get(275, 755),
      dueDate: get(338, 705),

      amountFields: {
        amount1: get(562, 200),
        amount2: get(605, 200),
        amount3: get(625, 200),
        amount4: get(645, 200),
        amount5: get(670, 200),
      },
    }

    // 8. Validate required fields
    const errors = []

    if (!/^\d{14}$/.test(bill.referenceNumber)) {
      errors.push("Reference number must contain exactly 14 digits.")
    }

    if (!/^\d+$/.test(bill.customerId)) {
      errors.push("Customer ID is missing or invalid.")
    }

    if (!bill.customerName) {
      errors.push("Customer name is missing.")
    }

    if (!bill.address) {
      errors.push("Customer address is missing.")
    }

    if (!bill.meter.meterNumber) {
      errors.push("Meter number is missing.")
    }

    if (errors.length > 0) {
      throw new Error(`parseBill: Bill validation failed:\n- ${errors.join("\n- ")}`)
    }

    return bill
  },

  safeExecute: async (fn, ...args) => {
    try {
      const data = await fn(...args)

      return {
        success: true,
        data,
        error: null,
      }
    } catch (error) {
      console.error(`[${fn.name || "Function"}] Failed:`, error)

      return {
        success: false,
        data: null,
        error: {
          message: error?.message || "An unexpected error occurred.",
          name: error?.name || "Error",
        },
      }
    }
  },

  parseCookies(response) {
    const raw = response.headers.raw()["set-cookie"]
    return raw?.map((entry) => entry.split(";")[0])?.join(";") || ""
  },

  mapToFormData: (map) => {
    const formData = new FormData()
    Object.entries(map).forEach(([key, value]) => {
      formData.append(key, value)
    })
    return formData
  },
}

export { Utils }
