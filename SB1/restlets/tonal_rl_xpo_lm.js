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
        shipDate: inputDate,
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
    return dateArray[0] + '-' + dateArray[1] + '-' + dateArray[2]
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
    let etaDate = new Date(shipDate)
    etaDate.setMinutes(
      etaDate.getMinutes() + etaDate.getTimezoneOffset(),
    )

    for (let i = 0; i < daysToAdd; i++) {
      switch (etaDate.getDay()) {
        //Friday & Saturday
        case 5:
        case 6:
          etaDate.setDate(etaDate.getDate() + 2)
        default:
          etaDate.setDate(etaDate.getDate() + 1)
      }
    }

    return `${etaDate.getFullYear()}-${
      etaDate.getMonth() + 1
    }-${etaDate.getDate()}`
  }

  const calculateCustomerEtaDate = (etaDate, daysToProcess) => {
    let customerEtaDate = new Date(etaDate)
    customerEtaDate.setMinutes(
      customerEtaDate.getMinutes() +
        customerEtaDate.getTimezoneOffset(),
    )

    for (let i = 0; i < daysToProcess; i++) {
      switch (customerEtaDate.getDay()) {
        // Friday & Saturday
        case 5:
        case 6:
          customerEtaDate.setDate(customerEtaDate.getDate() + 2)
        default:
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
