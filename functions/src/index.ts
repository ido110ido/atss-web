import {setGlobalOptions} from "firebase-functions";

setGlobalOptions({maxInstances: 10});

export {onRouteFileUploaded} from "./handlers/onRouteFileUploaded.js";
// export { morningPush } from "./handlers/morningPush.js";
export {whatsappWebhook} from "./handlers/whatsappWebhook.js";
export {testMorningPush, triggerMorningPush} from "./handlers/morningPush.js";
export {updateDeliveryStatus} from "./handlers/deliveryStatus.js";
export {onWorkerPhoneChanged} from "./handlers/workerTriggers.js";
