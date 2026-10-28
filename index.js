import { BillDownloader } from "./src/app/bill/bill-downloader.js"

console.log("start running")
const start = performance.now()
let bills = await new BillDownloader().start(["7391516"])
console.log({bills})
const end = performance.now()
console.log(`Execution time: ${(end - start).toFixed(2) / 1000} ms`)
