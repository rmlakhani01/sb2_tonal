/**
 *@NApiVersion 2.1
 *@NScriptType Restlet
 */
define(['N/search'], function (search) {
  function _post(context) {
    log.debug('payload', context)
    try {
      let etaDate, custEtaDate
      const transitDays = crossReferenceTable(
        context.destinationLocationID,
        context.originLocationID,
      )

      log.debug('transitDays', transitDays)
      let inputDate = context.shipDate
      if (!inputDate.includes('-')) {
        inputDate = parseStringToDate(inputDate)
        inputDate = formatString(inputDate)
      }

      if (inputDate.includes('-')) {
        inputDate = formatString(inputDate)
      }

      if (transitDays && transitDays.length === 0) {
        etaDate = calculateEtaDate(inputDate, 7)
        custEtaDate = etaDate
      }

      if (transitDays && transitDays.length > 0) {
        etaDate = calculateEtaDate(
          inputDate,
          transitDays[0].transitDays,
        )
        custEtaDate = calculateCustomerEtaDate(
          etaDate,
          transitDays[0].processingTime,
        )
      }

      log.debug('RESPONSE', {
        venderEtaDate: etaDate,
        customerEtaDate: custEtaDate,
      })

      return {
        vendorEtaDate: etaDate,
        customerEtaDate: custEtaDate,
      }
    } catch (error) {
      log.debug('error', error.message)
    }
  }

  const parseStringToDate = (inputDate) => {
    let date =
      inputDate.slice(0, 4) +
      '-' +
      inputDate.slice(4, 6) +
      '-' +
      inputDate.slice(6, 8)
    return date
  }

  const formatString = (dateString) => {
    var dateArray = dateString.split('-')
    return dateArray[1] + '/' + dateArray[2] + '/' + dateArray[0]
  }

  const crossReferenceTable = (destination, origin) => {
    const records = []
    search
      .create({
        type: 'customrecord_mm_lmh_transit_time',
        filters: [
          {
            name: 'custrecord_hub_id',
            join: 'custrecorddestination_location_lmh',
            operator: search.Operator.IS,
            values: destination,
          },
          {
            name: 'name',
            join: 'custrecord_origin_location',
            operator: search.Operator.IS,
            values: origin,
          },
        ],
        columns: [
          {
            name: 'custrecord_transit_time_days',
          },
          {
            name: 'custrecord_processing_time_days',
          },
        ],
      })
      .run()
      .each((result) => {
        records.push({
          transitDays: result.getValue({
            name: 'custrecord_transit_time_days',
          }),
          processingTime: result.getValue({
            name: 'custrecord_processing_time_days',
          }),
        })
        return true
      })
    return records
  }

  const calculateEtaDate = (shipDate, daysToAdd) => {
    const etaDate = new Date(shipDate)

    // increments the business days
    for (let i = 0; i != daysToAdd; i++) {
      if (etaDate.getDay() === 6) {
        etaDate.setDate(etaDate.getDate() + 2)
      } else if (etaDate.getDay() === 0) {
        etaDate.setDate(etaDate.getDate() + 1)
      } else if (etaDate.getDay() === 5) {
        etaDate.setDate(etaDate.getDate() + 3)
      } else {
        etaDate.setDate(etaDate.getDate() + 1)
      }
    }

    return `${etaDate.getFullYear()}-${
      etaDate.getMonth() + 1
    }-${etaDate.getUTCDate()}`
  }

  const calculateCustomerEtaDate = (etaDate, daysToProcess) => {
    const customerEtaDate = new Date(etaDate)
    for (let i = 0; i != daysToProcess; i += 1) {
      if (customerEtaDate.getDay() === 6) {
        customerEtaDate.setDate(customerEtaDate.getDate() + 2)
      } else if (customerEtaDate.getDay() === 0) {
        customerEtaDate.setDate(customerEtaDate.getDate() + 1)
      } else if (customerEtaDate.getDay() === 5) {
        customerEtaDate.setDate(customerEtaDate.getDate() + 3)
      } else {
        customerEtaDate.setDate(customerEtaDate.getDate() + 1)
      }
    }

    return `${customerEtaDate.getFullYear()}-${
      customerEtaDate.getMonth() + 1
    }-${customerEtaDate.getDate()}`
  }

  return {
    post: _post,
  }
})
