import { Utils } from "./utils.js"
import fetch from "node-fetch"
import * as Cheerio from "cheerio"
import { format, parse } from "date-fns"
import { Buffer } from "buffer"

const BILL_DOWNLOAD_PATH = "https://bill.lesco.gov.pk:36260/Bill.aspx"
const BILL_DOWNLOAD_PATH_MDI = "https://bill.lesco.gov.pk:36260/BillNewMDI.aspx"
const CHECK_BILL_PATH = "https://www.lesco.gov.pk/Modules/CustomerBillNC/CheckBill.asp"
const STATIC_CAPTCHA = "1234"

class Lesco {
  lescoHostUrl = ""
  billIdentifier = null

  async processId(customerId) {
    // Establish the initial web session
    const response = await fetch(CHECK_BILL_PATH, {
      method: "GET",
    })

    const cookies = Utils.parseCookies(response)

    this.lescoHostUrl = new URL(response.url).host

    // Find the account-status form and its required data
    const accountStatusUrlInfo = await this.getAccountStatusUrl(cookies, customerId)
    this.billIdentifier = accountStatusUrlInfo.formDataMap

    const billHTML = await this.downloadBill_HTML(cookies, accountStatusUrlInfo?.billDownloadUrl)
    const parsedHTML = Utils.parseBill(billHTML)
    console.log({ parsedHTML })
    return parsedHTML
  }

  async downloadBill_HTML(cookies, downloadUrl) {
    function renameKeys(obj) {
      const entries = Object.keys(obj).map((key) => {
        const newKey = key.replace(/^str/, "").replace(/^n/, "")
        return { [newKey]: obj[key] }
      })
      return Object.assign({}, ...entries)
    }
    const url = downloadUrl
    const formDataMap = renameKeys(this.billIdentifier)
    formDataMap["CapCode"] = STATIC_CAPTCHA
    const response = await fetch(url, {
      method: "post",
      headers: { cookie: cookies },
      body: Utils.mapToFormData(formDataMap),
    })

    const responseText = await response.text()
    return responseText
  }

  async getAccountStatusUrl(cookies, customerId) {
    const response = await this.postRequest(cookies, customerId, "btnViewMenu=Customer+Menu")

    const data = await response.text()
    const $ = Cheerio.load(data)
    await this.generateCaptcha(cookies)
    const formDataMap = {}
    const form = $('.checkbill_table form.inline[action*="AccountStatus"]')
    // Find a <form> inside .checkbill_table, whose class is inline, and whose action contains "AccountStatus".
    const downloadBillUrl = this.getNextUrl(response.url, $(".billform").attr("action"))
    // It finds something like:
    // <form class="billform" action="Bill.aspx">
    // Then :- getNextUrl() converts the relative URL into a full URL.

    const newUrl = this.getNextUrl(response.url, form.attr("action"))
    // Find the account status URL
    // Get all form data
    Object.values($(".checkbill_table form.inline > input"))
      .map((x) => x.attribs)
      .filter((x) => x)
      .forEach((x) => {
        formDataMap[x.name] = x.value
      })
    Object.values($(".checkbill_table form.inline > button"))
      .map((x) => x.attribs)
      .filter((x) => x)
      .forEach((x) => {
        formDataMap[x.name] = x.value
      })
    return {
      accountStatusUrl: newUrl,
      formDataMap: formDataMap,
      billDownloadUrl: downloadBillUrl.includes("MDI") ? BILL_DOWNLOAD_PATH_MDI : BILL_DOWNLOAD_PATH,
    }
  }

  // getAccountStatusUrl
  async generateCaptcha(cookies) {
    const captchaUrl = `https://${this.lescoHostUrl}/Web/GenerateCaptcha.aspx?code=${STATIC_CAPTCHA}&Usecode=1`
    await fetch(captchaUrl, { method: "get", headers: { cookie: cookies } }).then()
  }

  // getAccountStatusUrl
  getNextUrl(currentUrl, nextPath) {
    if (nextPath.startsWith("http")) {
      return nextPath
    } else if (nextPath.startsWith("/")) {
      const urlObject = new URL(currentUrl)
      urlObject.pathname = nextPath
      return urlObject.href
    } else {
      const urlObject = new URL(currentUrl)
      urlObject.pathname = urlObject.pathname.replace(/[^/]+$/, nextPath)
      return urlObject.href
    }
  }

  // getAccountStatus
  getFieldValue(fieldNamesToFind, rows) {
    for (let row of rows) {
      if (row.childNodes) {
        const heading = row.childNodes.filter((c) => c.name == "h5")[0]
        const headingName = heading?.children?.[0]?.data
        if (headingName === fieldNamesToFind) {
          const valueField = row.children.filter((x) => x.name == "strong")[0]
          return valueField.children[0].data
        }
      }
    }
    return null
  }

  // getAccountStatusUrl
  async postRequest(cookies, customerId, additionalFormData = "") {
    let data = `txtCustID=${customerId}&${additionalFormData}`
    let response = null
    await fetch(`https://${this.lescoHostUrl}/Modules/CustomerBillN/CustomerMenu.asp`, {
      method: "post",
      body: data,
      headers: {
        cookie: cookies,
        accept: "*/*",
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })
      .then(async (res) => (response = res))
      .catch((err) => {
        console.log("Error", err)
      })
    return response
  }
}
export { Lesco }
