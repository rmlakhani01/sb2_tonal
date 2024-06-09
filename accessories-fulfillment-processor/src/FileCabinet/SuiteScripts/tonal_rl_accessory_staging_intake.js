/**
 *@NApiVersion 2.1
 *@NScriptType Restlet
 */
define(['N/record'], function (record) {
  const post = (context) => {
    try {
      let results = []
      // let responses = []
      var shipment = context
      if (
        shipment.header.Distribution_Center.startsWith('E') === true
      )
        results.push(populateStageRecordwithExtronData(shipment))

      if (
        shipment.header.Distribution_Center.startsWith('G') === true
      )
        results.push(populateStageRecordwithGilbertData(shipment))

      return results
    } catch (e) {
      log.debug('ERROR: ', e.message)
      log.debug('ERROR: ', e.stack)
    }
  }

  const populateStageRecordwithExtronData = (shipment) => {
    let responseObject = {}
    responseObject.type = 'ACCESSORIES_STAGING_RECORD_TONAL'
    responseObject.errors = []
    responseObject.successfulRecords = []

    try {
      if (!shipment.header) {
        responseObject.errors.push('ERROR - MISSING HEADER DETAILS')
        log.debug('ERROR', 'MISSING HEADER DETAILS')
      }

      if (!shipment.line) {
        responseObject.errors.push('ERROR - MISSING LINES DETAILS')
        log.debug('ERROR', 'MISSING LINE DETAILS')
      }

      if (!shipment.status) {
        responseObject.errors.push('ERROR - MISSING STATUS')
        log.debug('ERROR', 'MISSING STATUS')
      }

      if (!shipment.line[0].Tracking) {
        responseObject.errors.push('ERROR - MISSING TRACKING NUMBER')
        log.debug('ERROR', 'MISSING TRACKING NUMBER')
      }

      if (!shipment.class) {
        responseObject.errors.push('ERROR - MISSING CLASSIFICATION')
        log.debug('ERROR', 'MISSING CLASSIFICATION')
      }

      if (!shipment.header.Distribution_Center) {
        responseObject.errors.push('ERROR - MISSING 3PL')
        log.debug('ERROR', 'MISSING 3PL')
      }

      let numOfPackages = new Set()
      shipment.line.forEach((line) =>
        numOfPackages.add(line.Tracking),
      )

      for (const trackingNumber of numOfPackages) {
        let res = {}
        ;(res.type = 'ACCESSORIES_STAGING_RECORD_TONAL'),
          (res.name = `${shipment.header.Delivery_ID}_${trackingNumber}`)

        const customRecord = record.create({
          type: 'customrecord_accessory_staging',
          isDynamic: true,
        })
        customRecord.setValue({
          fieldId: 'name',
          value: `${shipment.header.Delivery_ID}_${trackingNumber}`,
        })
        customRecord.setValue({
          fieldId: 'externalid',
          value: `${shipment.header.Delivery_ID}_${trackingNumber}`,
        })
        customRecord.setValue({
          fieldId: 'custrecord_stg_header',
          value: JSON.stringify(shipment.header),
        })
        customRecord.setValue({
          fieldId: 'custrecord_stg_lines',
          value: JSON.stringify(
            shipment.line.filter(
              (line) => line.Tracking === trackingNumber,
            ),
          ),
        })
        customRecord.setValue({
          fieldId: 'custrecord_stg_status',
          value: shipment.status,
        })
        customRecord.setValue({
          fieldId: 'custrecord_stg_tracking_num',
          value: trackingNumber,
        })
        customRecord.setValue({
          fieldId: 'custrecord_stg_class',
          value: shipment.class,
        })
        customRecord.setValue({
          fieldId: 'custrecord_stg_3pl',
          value: shipment.header.Distribution_Center,
        })
        res.id = customRecord.save()
        if (res.id) responseObject.successfulRecords.push(res)
      }

      return responseObject
    } catch (error) {
      responseObject.errors.push(error)
      return responseObject
    }
  }

  const populateStageRecordwithGilbertData = (shipment) => {
    let responseObject = {}
    responseObject.type = 'ACCESSORIES_STAGING_RECORD_TONAL'
    responseObject.errors = []
    responseObject.successfulRecords = []

    try {
      if (!shipment.header) {
        responseObject.errors.push('ERROR - MISSING HEADER DETAILS')
        log.debug('ERROR', 'MISSING HEADER DETAILS')
      }

      if (!shipment.line) {
        responseObject.errors.push('ERROR - MISSING LINES DETAILS')
        log.debug('ERROR', 'MISSING LINE DETAILS')
      }

      if (!shipment.status) {
        responseObject.errors.push('ERROR - MISSING STATUS')
        log.debug('ERROR', 'MISSING STATUS')
      }

      if (!shipment.line[0].TRACKING_NUMBER) {
        responseObject.errors.push('ERROR - MISSING TRACKING NUMBER')
        log.debug('ERROR', 'MISSING TRACKING NUMBER')
      }

      if (!shipment.class) {
        responseObject.errors.push('ERROR - MISSING CLASSIFICATION')
        log.debug('ERROR', 'MISSING CLASSIFICATION')
      }

      if (!shipment.header.Distribution_Center) {
        responseObject.errors.push('ERROR - MISSING 3PL')
        log.debug('ERROR', 'MISSING 3PL')
      }

      let numOfPackages = new Set()
      shipment.line.forEach((line) =>
        numOfPackages.add(line.TRACKING_NUMBER),
      )

      for (const trackingNumber of numOfPackages) {
        let res = {}
        res.type = 'ACCESSORIES_STAGING_RECORD_TONAL'
        res.name = `${shipment.header.ORDER_NUMBER}_${trackingNumber}`

        const customRecord = record.create({
          type: 'customrecord_accessory_staging',
          isDynamic: true,
        })
        customRecord.setValue({
          fieldId: 'name',
          value: `${shipment.header.ORDER_NUMBER}_${trackingNumber}`,
        })
        customRecord.setValue({
          fieldId: 'externalid',
          value: `${shipment.header.ORDER_NUMBER}_${trackingNumber}`,
        })
        customRecord.setValue({
          fieldId: 'custrecord_stg_header',
          value: JSON.stringify(shipment.header),
        })
        customRecord.setValue({
          fieldId: 'custrecord_stg_lines',
          value: JSON.stringify(
            shipment.line.filter(
              (line) => line.TRACKING_NUMBER === trackingNumber,
            ),
          ),
        })
        customRecord.setValue({
          fieldId: 'custrecord_stg_status',
          value: shipment.status,
        })
        customRecord.setValue({
          fieldId: 'custrecord_stg_tracking_num',
          value: trackingNumber,
        })
        customRecord.setValue({
          fieldId: 'custrecord_stg_class',
          value: shipment.class,
        })
        customRecord.setValue({
          fieldId: 'custrecord_stg_3pl',
          value: shipment.header.Distribution_Center,
        })
        res.id = customRecord.save()
        if (res.id) responseObject.successfulRecords.push(res)
      }
      return responseObject
    } catch (error) {
      responseObject.errors.push(error)
      return responseObject
    }
  }

  return {
    post: post,
  }
})
