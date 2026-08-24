(function () {

    console.log("HP_Search IJ: WebSocket monitor installed");
   
    const OriginalWebSocket = window.WebSocket;
    let hpAnswer = null;

    window.WebSocket = new Proxy(OriginalWebSocket, {

        construct(target, args) {

            console.log("HP_Search IJ: WebSocket URL:", args[0]);

            const ws = new target(...args);

            ws.addEventListener("message", event => {

                //console.log("HP_Search: WebSocket raw:", event.data);

                try {
                    const data = JSON.parse(event.data);

                    //console.log("HP_Search: WebSocket JSON:", data);

                    if (data.activities) {

                        data.activities.forEach(activity => {
                            /*
                            if (activity.from?.role === "bot") {

                                console.log(
                                    "HP_Search FULL ACTIVITY:",
                                    JSON.stringify(activity, null, 2)
                                );

                            }
                            */
                            if (activity.type === "message" &&
                                activity.from?.role === "bot" &&
                                activity.channelData?.activityOrigin === "GenerativeContentSkill") {

                                if (!hpAnswer && activity.text) {
                                    let n = activity.text.indexOf("How can I help");
                                    if (n == 0) {
                                        console.log("HP_Search IJ: found 'How can I help'");
                                        return;
                                    }
                                    hpAnswer = activity.text;
                                    window.postMessage({    // send message to content.js
                                        source: "HP_Search",
                                        type: "HP_ANSWER_HELP",
                                        activity: activity
                                    }, "*");
                                }
                            }
                        });

                    }

                }
                catch (e) {
                    console.log("HP_Search: non JSON message");
                }

            });

            return ws;
        }

    });

})();