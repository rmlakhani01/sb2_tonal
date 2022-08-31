/**
 *@NApiVersion 2.1
 *@NScriptType ScheduledScript
 */
define(['N/search', 'N/record', './lodash'], function (
  search,
  record,
  _,
) {
  const execute = (context) => {
    try {
      const locationResults = getLocations()
      const locations = getLocationRecords(locationResults)
      const records = checkIfLocationRecordExists(locations)

      if (records && records[1].length > 0) {
        numberOfNewRecordsCreated = createNewRecord(records[1])
        log.debug(
          'Number of New Records Created.',
          numberOfNewRecordsCreated,
        )
      }
    } catch (error) {
      log.debug('ERROR - Message', error.message)
      log.debug('ERROR - Stack', error.stack)
    }
  }

  const getLocations = () => {
    const filters = [
      search.createFilter({
        name: 'city',
        operator: search.Operator.ISNOTEMPTY,
        values: [],
      }),
    ]

    const columns = [
      search.createColumn({ name: 'internalid' }),
      search.createColumn({ name: 'name' }),
    ]

    var results = search
      .create({
        type: 'location',
        filters: filters,
        columns: columns,
      })
      .run()
      .getRange({ start: 0, end: 1000 })

    return results
  }

  const getLocationRecords = (locationResults) => {
    const names_3pl = []
    if (locationResults) {
      locationResults.forEach((result) => {
        const record = {
          name: result.getValue({ name: 'name' }),
          id: result.getValue({ name: 'internalid' }),
        }
        names_3pl.push(record)
      })
    }

    return names_3pl
  }

  const checkIfLocationRecordExists = (names) => {
    const records = []
    const missingRecords = []
    names.forEach((name) => {
      const filter = [
        search.createFilter({
          name: 'custrecord_last_mile',
          operator: search.Operator.IS,
          values: name.id,
        }),
      ]

      const columns = [
        search.createColumn({ name: 'internalid' }),
        search.createColumn({ name: 'custrecord_last_mile' }),
      ]

      var rs = search
        .create({
          type: 'customrecord_3pl_locations',
          filters: filter,
          columns: columns,
        })
        .run()
        .getRange({ start: 0, end: 1000 })

      if (rs && rs.length > 0) {
        for (let i = 0; i < rs.length; i++) {
          const record = {
            internalid: rs[i].getValue({ name: 'internalid' }),
            name: rs[i].getText({
              name: 'custrecord_last_mile',
            }),
          }
          records.push(record)
        }
      }
      if (rs && rs.length == 0) {
        missingRecords.push(name)
      }
    })

    return [records, missingRecords]
  }

  const createNewRecord = (locations) => {
    var count = 0
    locations.forEach((location) => {
      if (typeof location === 'string') {
        location = JSON.parse(location)
      }
      const rec = record.create({
        type: 'customrecord_3pl_locations',
        isDyname: false,
      })

      rec.setValue({
        fieldId: 'custrecord_3pl_name',
        value: location.name.split(':')[0],
      })
      rec.setValue({
        fieldId: 'custrecord_order_limit',
        value: 150,
      })
      rec.setValue({
        fieldId: 'custrecord_overage_limit',
        value: 20,
      })
      rec.setValue({
        fieldId: 'custrecord_last_mile',
        value: location.id,
      })

      var id = rec.save()
      if (id) count += 1
    })

    return count
  }

  return {
    execute: execute,
  }
})
