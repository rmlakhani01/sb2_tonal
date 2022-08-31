/**
 *@NApiVersion 2.1
 *@NScriptType ClientScript
 */
define(['N/currentRecord', 'N/search'], function (
  currentRecord,
  search,
) {
  const pageInit = async (context) => {
    if (context.mode === 'create') {
      alert('Please wait. Items are loading...')
      // runs saved search asynchronously and returns an array of item ids
      const itemIds = await getItems()
      const record = currentRecord.get()
      for (let i = 0; i < itemIds.length; i++) {
        record.selectNewLine({ sublistId: 'item' })
        record.setCurrentSublistValue({
          sublistId: 'item',
          fieldId: 'item',
          line: i,
          value: itemIds[i],
          forceSyncSourcing: true,
        })
        record.setCurrentSublistValue({
          sublistId: 'item',
          fieldId: 'quantity',
          line: i,
          value: 1,
          forceSyncSourcing: true,
        })
        record.commitLine({ sublistId: 'item' })
      }
    }
  }

  const getItems = async () => {
    const items = []
    await search.load
      .promise({
        type: search.Type.ITEM,
        id: 'customsearch499',
      })
      .then((result) => {
        result.run().each((item) => {
          items.push(item.id)
          return true
        })
      })
      .catch((error) => {
        if (error.name === 'INVALID_SEARCH') {
          alert(error.message)
        } else {
          log.debug('ERROR', JSON.stringify(error, null, 2))
        }
      })

    return items
  }

  return {
    pageInit: pageInit,
  }
})
