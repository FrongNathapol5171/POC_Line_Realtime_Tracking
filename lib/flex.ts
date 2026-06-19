import { Patient, Clinic } from './types'

type FlexMessage = {
  type: 'flex'
  altText: string
  contents: object
}

export function buildRoadmapFlex(patient: Patient, clinics: Clinic[]): FlexMessage {
  const sequence: string[] = JSON.parse(patient.sequenceJson || '[]')
  const clinicMap = Object.fromEntries(clinics.map(c => [c.clinicId, c]))

  const steps = sequence.map((clinicId, idx) => {
    const clinic = clinicMap[clinicId]
    const isDone = idx < patient.currentIndex
    const isCurrent = idx === patient.currentIndex
    const icon = isDone ? '✅' : isCurrent ? '🟦' : '⬜'
    const nameColor = isCurrent ? '#0066CC' : isDone ? '#16a34a' : '#111111'

    return {
      type: 'box',
      layout: 'horizontal',
      spacing: 'md',
      margin: 'md',
      contents: [
        {
          type: 'text',
          text: icon,
          flex: 0,
          size: 'lg',
          gravity: 'top',
        },
        {
          type: 'box',
          layout: 'vertical',
          flex: 1,
          contents: [
            {
              type: 'text',
              text: clinic?.name ?? clinicId,
              weight: 'bold',
              color: nameColor,
              wrap: true,
            },
            {
              type: 'text',
              text: clinic?.detail ?? '',
              size: 'xs',
              color: '#888888',
              wrap: true,
            },
          ],
        },
      ],
    }
  })

  return {
    type: 'flex',
    altText: `สถานะการรักษา HN: ${patient.hn}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0066CC',
        paddingAll: 'lg',
        contents: [
          {
            type: 'text',
            text: 'เส้นทางการรักษา',
            weight: 'bold',
            size: 'lg',
            color: '#FFFFFF',
          },
          {
            type: 'text',
            text: `HN: ${patient.hn}`,
            size: 'sm',
            color: '#CCE0FF',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'none',
        contents: steps,
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#dc2626',
            action: {
              type: 'postback',
              label: 'ต้องการความช่วยเหลือ / Need help',
              data: `action=help&hn=${patient.hn}`,
              displayText: 'ขอความช่วยเหลือ',
            },
          },
        ],
      },
    },
  }
}

export function buildCompletionFlex(hn: string): FlexMessage {
  return {
    type: 'flex',
    altText: `เสร็จสิ้นการรักษา HN: ${hn}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#16a34a',
        paddingAll: 'lg',
        contents: [
          {
            type: 'text',
            text: '✅ เสร็จสิ้นทุกขั้นตอน',
            weight: 'bold',
            size: 'xl',
            color: '#FFFFFF',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `HN: ${hn}`,
            size: 'md',
            color: '#555555',
          },
          {
            type: 'text',
            text: 'ขอบคุณที่ใช้บริการ / Thank you for your visit.',
            wrap: true,
            margin: 'md',
            color: '#333333',
          },
        ],
      },
    },
  }
}
