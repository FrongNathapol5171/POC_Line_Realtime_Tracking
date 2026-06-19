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

    // LINE rejects text elements with empty string — only include detail when non-empty
    const clinicName = (clinic?.name ?? clinicId).trim() || clinicId
    const clinicDetail = (clinic?.detail ?? '').trim()

    const innerContents: object[] = [
      {
        type: 'text',
        text: clinicName,
        weight: 'bold',
        color: nameColor,
        wrap: true,
      },
    ]

    if (clinicDetail) {
      innerContents.push({
        type: 'text',
        text: clinicDetail,
        size: 'xs',
        color: '#888888',
        wrap: true,
      })
    }

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
          contents: innerContents,
        },
      ],
    }
  })

  const hn = patient.hn || 'Unknown'

  return {
    type: 'flex',
    altText: `Patient Journey — HN: ${hn}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#22394d',
        paddingAll: 'lg',
        contents: [
          {
            type: 'text',
            text: 'Patient Journey',
            weight: 'bold',
            size: 'lg',
            color: '#FFFFFF',
          },
          {
            type: 'text',
            text: `HN: ${hn}`,
            size: 'sm',
            color: '#a8c0d6',
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
            color: '#22394d',
            action: {
              type: 'postback',
              label: 'ขอความช่วยเหลือ',
              data: `action=help&hn=${hn}`,
              displayText: 'Need Help / ขอความช่วยเหลือ',
            },
          },
        ],
      },
    },
  }
}

export function buildCompletionFlex(hn: string): FlexMessage {
  const safeHn = hn || 'Unknown'
  return {
    type: 'flex',
    altText: `Journey Complete — HN: ${safeHn}`,
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
            text: 'Journey Complete',
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
            text: `HN: ${safeHn}`,
            size: 'md',
            color: '#555555',
          },
          {
            type: 'text',
            text: 'All steps complete. Thank you for visiting.',
            wrap: true,
            margin: 'md',
            color: '#333333',
          },
        ],
      },
    },
  }
}
