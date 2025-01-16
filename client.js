// Get HTML elements
const chatLog = document.getElementById("chatLog");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const name = document.getElementById("name");

// WebSocket signaling server URL
const client_name = `client_${Math.random().toString(36).substring(2, 10)}`;
const signalingServerUrl = "ws://4.233.219.37:8000/ws/" + client_name;
name.innerHTML = client_name;
const signalingServer = new WebSocket(signalingServerUrl);

// Create WebRTC PeerConnection
const peerConnection = new RTCPeerConnection();

// DataChannel for P2P chat
let dataChannel = peerConnection.createDataChannel("chat");

// Function to append messages to the chat log
function appendToChatLog(message, sender = "Peer") {
  chatLog.value += `${sender}: ${message}\n`;
  chatLog.scrollTop = chatLog.scrollHeight; // Auto-scroll to the latest message
}

// Event: DataChannel opened
dataChannel.onopen = () => {
  console.log("P2P DataChannel is open!");
};

// Event: DataChannel closed
dataChannel.onclose = () => {
  console.log("P2P DataChannel is closed!");
};

// Event: Handle incoming messages
dataChannel.onmessage = (event) => {
  appendToChatLog(event.data, "Peer");
};

// Event: Handle Send Button click
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

// Handle WebSocket signaling
signalingServer.onmessage = async (event) => {
  const message = JSON.parse(event.data);

  if (message.type === "offer") {
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(message)
    );
    const answer = await peerConnection.createAnswer();
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

// Event: ICE Candidate Generation
peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    signalingServer.send(
      JSON.stringify({ type: "candidate", candidate: event.candidate })
    );
  }
};

// Event: Remote DataChannel created
peerConnection.ondatachannel = (event) => {
  const remoteDataChannel = event.channel;
  remoteDataChannel.onmessage = (e) => {
    appendToChatLog(e.data, "Peer");
  };
  remoteDataChannel.onopen = () => {
    console.log("Remote DataChannel is open!");
  };
};

// Function to create an SDP offer
async function createOffer() {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  signalingServer.send(JSON.stringify(offer));
}

// Start signaling process when connected to signaling server
signalingServer.onopen = () => {
  console.log("Connected to signaling server!");
  createOffer();
};

// Handle signaling server errors or disconnection
signalingServer.onerror = (error) => {
  console.error("Signaling server error:", error);
};

signalingServer.onclose = () => {
  console.log("Signaling server connection closed.");
};
