peguei os segunites logs de erros em produção...

{"level":30,"time":"2026-06-10T14:54:25.810Z","pid":1,"hostname":"b6c9795a0674","ip":"189.7.228.79","path":"/images/public/53bf80c9-9955-42b0-adf8-7c96f94498d3.png","msg":"Incoming request"}
{"level":30,"time":"2026-06-10T14:54:29.950Z","pid":1,"hostname":"b6c9795a0674","ip":"189.7.228.79","path":"/backoffice/private/adminUser","msg":"Incoming request"}
{"level":30,"time":"2026-06-10T14:54:29.951Z","pid":1,"hostname":"b6c9795a0674","ip":"189.7.228.79","path":"/backoffice/private/adminUser/finances/records","msg":"Incoming request"}
{"level":30,"time":"2026-06-10T14:54:29.959Z","pid":1,"hostname":"b6c9795a0674","ip":"189.7.228.79","path":"/backoffice/private/adminUser/finances/summary","msg":"Incoming request"}
{"level":30,"time":"2026-06-10T14:54:30.135Z","pid":1,"hostname":"b6c9795a0674","ip":"189.7.228.79","path":"/backoffice/private/adminUser/finances/records","msg":"Incoming request"}
{"level":30,"time":"2026-06-10T14:54:30.139Z","pid":1,"hostname":"b6c9795a0674","ip":"189.7.228.79","path":"/backoffice/private/adminUser","msg":"Incoming request"}
TypeError: Cannot read properties of undefined (reading 'forEach')
    at getAmountOfTimeBlocksToBeAppointed (/usr/src/ifute-core-simple/build/apps/mobile/utils/helpers/place.js:37:12)
    at computeOrderFinancials (/usr/src/ifute-core-simple/build/apps/backoffice/services/adminUser.service.js:220:80)
    at /usr/src/ifute-core-simple/build/apps/backoffice/services/adminUser.service.js:104:25
    at Array.map (<anonymous>)
    at listFinanceRecords (/usr/src/ifute-core-simple/build/apps/backoffice/services/adminUser.service.js:103:30)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
{"level":30,"time":"2026-06-10T14:54:30.156Z","pid":1,"hostname":"b6c9795a0674","ip":"189.7.228.79","path":"/backoffice/private/adminUser/finances/summary","msg":"Incoming request"}
TypeError: Cannot read properties of undefined (reading 'forEach')
    at getAmountOfTimeBlocksToBeAppointed (/usr/src/ifute-core-simple/build/apps/mobile/utils/helpers/place.js:37:12)
    at computeOrderFinancials (/usr/src/ifute-core-simple/build/apps/backoffice/services/adminUser.service.js:220:80)
    at getFinanceSummary (/usr/src/ifute-core-simple/build/apps/backoffice/services/adminUser.service.js:72:34)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
{"level":30,"time":"2026-06-10T14:54:31.361Z","pid":1,"hostname":"b6c9795a0674","ip":"189.7.228.79","path":"/backoffice/private/adminUser/finances/summary","msg":"Incoming request"}
{"level":30,"time":"2026-06-10T14:54:31.364Z","pid":1,"hostname":"b6c9795a0674","ip":"189.7.228.79","path":"/backoffice/private/adminUser/finances/records","msg":"Incoming request"}
TypeError: Cannot read properties of undefined (reading 'forEach')
    at getAmountOfTimeBlocksToBeAppointed (/usr/src/ifute-core-simple/build/apps/mobile/utils/helpers/place.js:37:12)
    at computeOrderFinancials (/usr/src/ifute-core-simple/build/apps/backoffice/services/adminUser.service.js:220:80)
    at getFinanceSummary (/usr/src/ifute-core-simple/build/apps/backoffice/services/adminUser.service.js:72:34)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
TypeError: Cannot read properties of undefined (reading 'forEach')
    at getAmountOfTimeBlocksToBeAppointed (/usr/src/ifute-core-simple/build/apps/mobile/utils/helpers/place.js:37:12)
    at computeOrderFinancials (/usr/src/ifute-core-simple/build/apps/backoffice/services/adminUser.service.js:220:80)
    at /usr/src/ifute-core-simple/build/apps/backoffice/services/adminUser.service.js:104:25
    at Array.map (<anonymous>)
    at listFinanceRecords (/usr/src/ifute-core-simple/build/apps/backoffice/services/adminUser.service.js:103:30)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)



Isso foi ao acessar a tela de finanças no backoffice no local de id "place_id": "f65816f4-53a5-4ed2-9014-40551223b089",

consegue confirmar se é um problema, ou é esperado

em outros locais o problema nao ocorre...
