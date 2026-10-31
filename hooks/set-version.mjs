// The hub runs this after telling open chats about a plugin update: records the installed version.
import { installedVersion, recordVersion } from './config.mjs'
const v = process.argv[2] || installedVersion()
console.log(recordVersion(v) ? `Recorded chat-hub-core ${v}.` : 'Nothing recorded (no git folder or no installed version found).')
