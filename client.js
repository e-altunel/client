const chatLog = document.getElementById("chatLog");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");

const client_name = `client_${Math.random().toString(36).substring(2, 10)}`;
const signalingServerUrl = "ws://altunel.online/ws/" + client_name;
document.getElementById("name").innerHTML = client_name;
const signalingServer = new WebSocket(signalingServerUrl);

const peerConnection = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
});

let dataChannel = peerConnection.createDataChannel("chat");

function appendToChatLog(message, sender = "Peer") {
  chatLog.value += `${sender}: ${message}\n`;
  chatLog.scrollTop = chatLog.scrollHeight; // Auto-scroll to the latest message
}

dataChannel.onopen = () => {
  console.log("P2P DataChannel is open!");
};

dataChannel.onclose = () => {
  console.log("P2P DataChannel is closed!");
};

dataChannel.onmessage = (event) => {
  appendToChatLog(event.data, "Peer");
};

sendButton.onclick = () => {
  const message = messageInput.value.trim();
  if (message) {
    if (dataChannel.readyState === "open") {
      dataChannel.send(message); // Send message to peer
      appendToChatLog(message, "You"); // Show your message in the chat log
      messageInput.value = ""; // Clear input field
    } else {
      console.error("DataChannel is not open.");
      appendToChatLog("Failed to send. DataChannel is not open.", "System");
    }
  }
};

signalingServer.onmessage = async (event) => {
  const message = JSON.parse(event.data);

  if (message.type === "offer") {
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(message)
    );
    const answer = await peerConnection.createAnswer();
    console.log("Answer created:", answer);
    await peerConnection.setLocalDescription(answer);
    signalingServer.send(JSON.stringify(peerConnection.localDescription));
  } else if (message.type === "answer") {
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(message)
    );
  } else if (message.type === "candidate") {
    await peerConnection.addIceCandidate(
      new RTCIceCandidate(message.candidate)
    );
  }
};

peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    signalingServer.send(
      JSON.stringify({ type: "candidate", candidate: event.candidate })
    );
  }
};

peerConnection.ondatachannel = (event) => {
  const remoteDataChannel = event.channel;
  remoteDataChannel.onmessage = (e) => {
    appendToChatLog(e.data, "Peer");
  };
  remoteDataChannel.onopen = () => {
    console.log("Remote DataChannel is open!");
  };
};

async function createOffer() {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  signalingServer.send(JSON.stringify(offer));
}

signalingServer.onopen = () => {
  console.log("Connected to signaling server!");
  createOffer();
};

signalingServer.onerror = (error) => {
  console.error("Signaling server error:", error);
};

signalingServer.onclose = () => {
  console.log("Signaling server connection closed.");
};
