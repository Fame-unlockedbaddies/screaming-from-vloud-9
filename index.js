DiscordAPIError[50035]: Invalid Form Body
0.options[4][APPLICATION_COMMAND_OPTIONS_REQUIRED_INVALID]: Required options must be placed before non-required options
    at handleErrors (/opt/render/project/src/node_modules/@discordjs/rest/dist/index.js:762:13)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
    at async SequentialHandler.runRequest (/opt/render/project/src/node_modules/@discordjs/rest/dist/index.js:1163:23)
    at async SequentialHandler.queueRequest (/opt/render/project/src/node_modules/@discordjs/rest/dist/index.js:994:14)
    at async _REST.request (/opt/render/project/src/node_modules/@discordjs/rest/dist/index.js:1307:22)
    at async /opt/render/project/src/index.js:73:3 {
  requestBody: { files: undefined, json: [ [Object] ] },
  rawError: {
    message: 'Invalid Form Body',
    code: 50035,
    errors: { '0': [Object] }
  },
  code: 50035,
  status: 400,
  method: 'PUT',
  url: 'https://discord.com/api/v10/applications/1500465549862240358/guilds/1428878035926388809/commands'
} Promise {
  <rejected> DiscordAPIError[50035]: Invalid Form Body
  0.options[4][APPLICATION_COMMAND_OPTIONS_REQUIRED_INVALID]: Required options must be placed before non-required options
      at handleErrors (/opt/render/project/src/node_modules/@discordjs/rest/dist/index.js:762:13)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
      at async SequentialHandler.runRequest (/opt/render/project/src/node_modules/@discordjs/rest/dist/index.js:1163:23)
      at async SequentialHandler.queueRequest (/opt/render/project/src/node_modules/@discordjs/rest/dist/index.js:994:14)
      at async _REST.request (/opt/render/project/src/node_modules/@discordjs/rest/dist/index.js:1307:22)
      at async /opt/render/project/src/index.js:73:3 {
    requestBody: { files: undefined, json: [Array] },
    rawError: { message: 'Invalid Form Body', code: 50035, errors: [Object] },
    code: 50035,
    status: 400,
    method: 'PUT',
    url: 'https://discord.com/api/v10/applications/1500465549862240358/guilds/1428878035926388809/commands'
  }
}
