import QRCode from 'qrcode'

export function buildDeepLink(hn: string, bindToken: string): string {
  const oaId = process.env.LINE_OA_BASIC_ID ?? ''
  const text = `ลงทะเบียนผู้ป่วย HN: ${hn} | TOKEN: ${bindToken}`
  const encoded = encodeURIComponent(text)
  return `https://line.me/R/oaMessage/${oaId}/?${encoded}`
}

export async function generateQrDataUrl(deepLink: string): Promise<string> {
  return QRCode.toDataURL(deepLink, { width: 400, margin: 2 })
}
