import { BillDownloader } from "@/app/bill/bill-downloader"
import nodemailer from "nodemailer"

export async function GET() {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // use STARTTLS (upgrade connection to TLS after connecting)
      auth: {
        user: "crickrank@gmail.com",
        pass: "cpcf vgro ouhq yqql",
      },
    })


    let bills = await new BillDownloader().start(["7391516"])

    const info = await transporter.sendMail({
      from: "crickrank@gmail.com",
      to: "abubakarzahid895@gmail.com",
      subject: "Sending Bill",
      text: JSON.stringify(bills),
    })

    return Response.json({
      success: true,
      messageId: info.messageId,
    })
  } catch (error) {
    console.error("Email error:", error)

    return Response.json({ success: false, error: "Failed to send email" }, { status: 500 })
  }
}
