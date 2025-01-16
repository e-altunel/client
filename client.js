const chatLog = document.getElementById("chatLog");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");

const client_name = `client_${Math.random().toString(36).substring(2, 10)}`;
const signalingServerUrl = "ws://altunel.online/ws/room/" + client_name;
document.getElementById("name").innerHTML = client_name;
const signalingServer = new WebSocket(signalingServerUrl);

const peers = {};
const dataChannels = {}; // Store data channels by peer ID

function appendToChatLog(message, sender = "Peer") {
  chatLog.value += `${sender}: ${message}\n`;
  chatLog.scrollTop = chatLog.scrollHeight; // Auto-scroll to the latest message
}

signalingServer.onmessage = async (event) => {
  const message = JSON.parse(event.data);

  if (message.type === "create_offer") {
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peers[message.client_id] = peerConnection;
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    signalingServer.send(
      JSON.stringify({
        type: "offer",
        offer,
        client_id: 0,
      })
    );
    dataChannels[message.client_id] = peerConnection.createDataChannel("chat");
  } else if (message.type === "offer") {
    let peerConnection;
    const client_id = message.client_id;
    if (client_id in peers) {
      peerConnection = peers[client_id];
    } else {
      peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      peerConnection.ondatachannel = (event) => {
        const remoteDataChannel = event.channel;
        remoteDataChannel.onmessage = (e) =>
          appendToChatLog(e.data, `Peer (${client_id})`);
        remoteDataChannel.onopen = () =>
          console.log(`DataChannel open with ${client_id}`);
      };

      peers[client_id] = peerConnection;
    }
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(message.offer)
    );

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    signalingServer.send(JSON.stringify({ type: "answer", answer, client_id }));
  } else if (message.type === "answer") {
    const client_id = message.client_id;
    const peerConnection = peers[client_id];
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(message.answer)
    );
  } else if (message.type === "candidate") {
    const client_id = message.client_id;
    const peerConnection = peers[client_id];
    await peerConnection.addIceCandidate(
      new RTCIceCandidate(message.candidate)
    );
  }
};

sendButton.onclick = () => {
  const message = messageInput.value.trim();
  if (message) {
    for (const peerId in dataChannels) {
      const dataChannel = dataChannels[peerId];
      if (dataChannel.readyState === "open") {
        dataChannel.send(message);
      }
    }
    appendToChatLog(message, "You");
    messageInput.value = "";
  }
};

signalingServer.onopen = () => {
  console.log("Connected to signaling server!");
};

signalingServer.onerror = (error) => {
  console.error("Signaling server error:", error);
};

signalingServer.onclose = () => {
  console.log("Signaling server connection closed.");
};
