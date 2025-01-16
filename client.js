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
    signalingServer.send({
      type: "offer",
      offer,
      client_id: 0,
    });
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
          appendToChatLog(e.data, `Peer (${peerId})`);
        remoteDataChannel.onopen = () =>
          console.log(`DataChannel open with ${peerId}`);
      };

      peers[peerId] = peerConnection;
    }

    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(message.offer.offer)
    );

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    signalingServer.send(
      JSON.stringify({ type: "answer", answer, peer: peerId })
    );
  } else if (message.type === "answer") {
    const peerId = message.peer;
    const peerConnection = peers[peerId];
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(message.answer)
    );
  } else if (message.type === "candidate") {
    const peerId = message.peer;
    const peerConnection = peers[peerId];
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
