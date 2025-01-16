const chatLog = document.getElementById("chatLog");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");

const client_name = `client_${Math.random().toString(36).substring(2, 10)}`;
const signalingServerUrl = "ws://altunel.online/ws/" + client_name;
document.getElementById("name").innerHTML = client_name;

const signalingServer = new WebSocket(signalingServerUrl);
const peerConnections = {}; // Store peer connections by client_name
const dataChannels = {}; // Store data channels by client_name

function appendToChatLog(message, sender = "Peer") {
  chatLog.value += `${sender}: ${message}\n`;
  chatLog.scrollTop = chatLog.scrollHeight; // Auto-scroll to the latest message
}

// Create a new peer connection for a specific peer
function createPeerConnection(peerName) {
  const peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      signalingServer.send(
        JSON.stringify({
          type: "candidate",
          candidate: event.candidate,
          sender: client_name,
          target: peerName,
        })
      );
    }
  };

  // Handle incoming DataChannel
  peerConnection.ondatachannel = (event) => {
    const remoteDataChannel = event.channel;
    dataChannels[peerName] = remoteDataChannel;

    remoteDataChannel.onmessage = (e) => {
      appendToChatLog(e.data, peerName);
    };

    remoteDataChannel.onopen = () => {
      console.log(`DataChannel with ${peerName} is open!`);
    };

    remoteDataChannel.onclose = () => {
      console.log(`DataChannel with ${peerName} is closed!`);
    };
  };

  return peerConnection;
}

// Create and send an offer to a new peer
async function createOffer(peerName) {
  const peerConnection = createPeerConnection(peerName);
  peerConnections[peerName] = peerConnection;

  const dataChannel = peerConnection.createDataChannel("chat");
  dataChannels[peerName] = dataChannel;

  dataChannel.onmessage = (event) => {
    appendToChatLog(event.data, peerName);
  };

  dataChannel.onopen = () => {
    console.log(`DataChannel with ${peerName} is open!`);
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  signalingServer.send(
    JSON.stringify({
      type: "offer",
      offer,
      sender: client_name,
      target: peerName,
    })
  );
}

// Handle incoming signaling messages
signalingServer.onmessage = async (event) => {
  const message = JSON.parse(event.data);
  const { type, sender, target, offer, answer, candidate } = message;

  if (target && target !== client_name) {
    // Ignore messages not intended for this client
    return;
  }

  if (type === "offer") {
    const peerConnection = createPeerConnection(sender);
    peerConnections[sender] = peerConnection;

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    signalingServer.send(
      JSON.stringify({
        type: "answer",
        answer,
        sender: client_name,
        target: sender,
      })
    );
  } else if (type === "answer") {
    const peerConnection = peerConnections[sender];
    if (peerConnection) {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    }
  } else if (type === "candidate") {
    const peerConnection = peerConnections[sender];
    if (peerConnection) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }
};

// Handle sending messages
sendButton.onclick = () => {
  const message = messageInput.value.trim();
  if (message) {
    Object.keys(dataChannels).forEach((peerName) => {
      const dataChannel = dataChannels[peerName];
      if (dataChannel.readyState === "open") {
        dataChannel.send(message); // Send message to each peer
        appendToChatLog(message, "You"); // Show your message in the chat log
      } else {
        appendToChatLog(`Failed to send to ${peerName}.`, "System");
      }
    });
    messageInput.value = ""; // Clear input field
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
