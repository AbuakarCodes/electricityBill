import { BillDownloader } from "@/app/bill/bill-downloader"
import nodemailer from "nodemailer"

export async function GET() {
  try {
    
    const start = performance.now()
    let bills = await new BillDownloader().start(["7391516"])
    console.log({bills})
    const end = performance.now()
    console.log(`Execution time to fetch bill: ${(end - start).toFixed(2) / 1000} ms`)



    const startEmal = performance.now()
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // use STARTTLS (upgrade connection to TLS after connecting)
      auth: {
        user: "crickrank@gmail.com",
        pass: "cpcf vgro ouhq yqql",
      },
    })

    const info = await transporter.sendMail({
      from: "crickrank@gmail.com",
      to: "abubakarzahid895@gmail.com",
      subject: "Sending Bill",
      text: JSON.stringify(bills),
    })

    
    const endEmail = performance.now()
    console.log(`Execution time to fetch send Email: ${(endEmail - startEmal).toFixed(2) / 1000} ms`)

    return Response.json({
      success: true,
      messageId: info.messageId,
    })
  } catch (error) {
    console.error("Email error:", error)

    return Response.json({ success: false, error: "Failed to send email" }, { status: 500 })
  }
}
