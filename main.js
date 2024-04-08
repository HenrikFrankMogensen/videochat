// Agora App ID for real-time messaging
let APP_ID = '2cbf5cc5ac154403b49b9c914a2d0159'

// Token is currently set to null
let token = null

// Generating a random user ID for the client
let uid = String(Math.floor(Math.random() * 10000))
// Is running in both the local and the remote peer connection

// Variables for client, channel, local stream, remote stream, and peer connection
let client
let channel

let queryString = window.location.search
let urlParams = new URLSearchParams(queryString)
let roomId = urlParams.get('room')

if(!roomId){
  window.location = 'lobby.html'
}

let localStream
let remoteStream
let peerConnection

// Configuration for ICE servers
const servers = {
  iceServers:[
    {
      urls:['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
    }
  ]
}

let constraints = {
  video:{
    width:{min:640, ideal:1920, max:1920},
    height:{min:480, ideal:1080, max:1080},
  },
  audio:true
}

// Initialization function
let init = async () => {
  // Creating an instance of Agora Real-Time Messaging
  client = await AgoraRTM.createInstance(APP_ID)
  
  // Logging into the client using generated UID and token
  await client.login({uid, token})

  // Creating a channel named the value of roomId for communication
  // roomId is comming from lobby.html and is the string which is an  
  // input coming from the form html in the file lobby.html
  channel = client.createChannel(roomId)
  
  // Joining the created channel
  await channel.join()

  // Event listeners for channel events
  channel.on('MemberJoined', handleUserJoined)
  channel.on('MemberLeft', handleUserLeft)


  client.on('MessageFromPeer', handleMessageFromPeer)

  // Getting local media stream (video) from user's device
  localStream = await navigator.mediaDevices.getUserMedia(constraints)
  
  // Displaying local stream on the user interface
  document.getElementById('user-1').srcObject = localStream
}

let handleUserLeft = (MemberId) => {
  document.getElementById('user-2').style.display = 'none'
  document.getElementById('user-1').classList.remove('smallFrame')
}

// Handling messages from peer
let handleMessageFromPeer = async (message, MemberId) => {
  message = JSON.parse(message.text)
  
  // Depending on the type of message received, appropriate actions are taken
  if(message.type === 'offer'){
    createAnswer(MemberId, message.offer)
  }
  if(message.type === 'answer'){
    addAnswer(message.answer)
  }
  if(message.type === 'candidate'){
    if(peerConnection){
      peerConnection.addIceCandidate(message.candidate)
    }
  }
}

// Handling user joined event
// MemberId is taken from the uid variable that contains a number
let handleUserJoined = async (MemberId) => {
  console.log('A new user joined the channel:', MemberId)
  createOffer(MemberId)
}

let createPeerConnection = async (MemberId) => {
  // Creating a new RTCPeerConnection instance
  peerConnection = new RTCPeerConnection(servers)
  /*
  The RTCPeerConnection interface represents a WebRTC connection between the local computer and a remote peer. It provides methods to connect to a remote peer, maintain and monitor the connection, and close the connection once it's no longer needed.
  */ 

  // Initialize remoteStream
  remoteStream = new MediaStream()
  document.getElementById('user-2').srcObject = remoteStream
  document.getElementById('user-2').style.display = 'block'

  document.getElementById('user-1').classList.add('smallFrame')

  // Getting local media stream and displaying it on user interface if not already available
  if(!localStream){
    localStream = await navigator.mediaDevices.getUserMedia({video:true, audio:false})
    document.getElementById('user-1').srcObject = localStream
  }

  // Adding local tracks to the peer connection
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream)
  })

  // Event handler for when a remote track is added
  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track)
    })
  }

  // Event handler for ICE candidates
  peerConnection.onicecandidate = async (event) => {
    if(event.candidate){
      client.sendMessageToPeer({text:JSON.stringify({'type':'candidate', 'candidate':event.candidate})}, MemberId)
    }
  }
}

// Creating offer function
let createOffer = async (MemberId) => {
  await createPeerConnection(MemberId)
  /*
  Waits for the createPeerConnection() function to end execution. The above function.
  */

  // Creating an offer and setting local description
  let offer = await peerConnection.createOffer()
  await peerConnection.setLocalDescription(offer)
  /*
  The await keyword tells JavaScript to pause the execution of the code until the promise returned by peerConnection.setLocalDescription(offer) resolves (løser: indtil promise returns). This means that the JavaScript engine will wait at this line until the operation completes.

  The setLocalDescription() method of the RTCPeerConnection 
  (peerConnection line 102) interface changes the local description  associated (forbundet) with the connection. This description (offer) specifies the properties of the local end of the connection, including the media format (.* end letters in the file name). The method takes a single parameter—*the session description—and it returns a *Promise which is fulfilled once the description has been changed, asynchronously.

  * The session description: In WebRTC (Web Real-Time Communication), session descriptions play a crucial role in establishing and managing peer-to-peer communication sessions directly between web browsers or other compatible applications. In WebRTC, the SDP (Session Description Protocol) is used to exchange (udveksle) session descriptions between the communicating peers.

  * Promise: In JavaScript, promises are objects that represent the eventual completion or failure of an asynchronous operation, such as fetching (hente) data from a server, reading a file, or performing a computation. In the code the line:
  return new Promise((resolve, reject) => {

  })
  will return a promise in the function with the parameters 'resolve' and 'reject'. And thats how it works...
  */

  // Sending the offer to the peer
  client.sendMessageToPeer({text:JSON.stringify({'type':'offer', 'offer':offer})}, MemberId)
  /*
  client = await AgoraRTM.createInstance(APP_ID):
  This line initializes an instance (object) of the Agora RTM client using the createInstance() method provided by the AgoraRTM object. The APP_ID variable contains your Agora App ID, which is a unique identifier for your application. (Line 1) The await keyword is used to wait for the asynchronous operation of creating the RTM client instance to complete before proceeding.

  client.sendMessageToPeer({text:JSON.stringify({'type':'offer', 'offer':offer})}, MemberId)
  Once the RTM client instance is created, this line sends a message to a specific peer using the sendMessageToPeer() method provided by the client object. The message payload (nyttelast: Det der sendes. Parameter) is an object containing a text property, which is a JSON stringified representation of another object containing information about an offer for a WebRTC session. (Sender offer data til remote peer connection). The MemberId variable likely represents the identifier of the peer to whom the message is being sent.
  */ 
}

// Creating answer function
let createAnswer = async (MemberId, offer) => {
  await createPeerConnection(MemberId)

  // Setting remote description with the received offer
  await peerConnection.setRemoteDescription(offer)
  //console.log(peerConnection)

  // Creating an answer and setting local description
  let answer = await peerConnection.createAnswer()
  await peerConnection.setLocalDescription(answer)
  
  //console.log(peerConnection)

  // Sending the answer to the peer
  client.sendMessageToPeer({text:JSON.stringify({'type':'answer', 'answer':answer})}, MemberId)
}

// Adding answer function
let addAnswer = async (answer) => {
  // Checking if remote description is not already set
  if(!peerConnection.currentRemoteDescription){
    peerConnection.setRemoteDescription(answer)
  }
}

let leaveChannel = async () => {
  await channel.leave()
  await client.logOut()
}

let toggleCamera = async () => {
  let videoTrack = localStream.getTracks().find(track => track.kind === 'video')
  if(videoTrack.enabled){
    videoTrack.enabled = false
    document.getElementById('camera-btn').style.backgroundColor = 'rgb(255, 80, 80)'
  } else {
    videoTrack.enabled = true
    document.getElementById('camera-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
  }
}

let toggleMic = async () => {
  let audioTrack = localStream.getTracks().find(track => track.kind === 'audio')
  if(audioTrack.enabled){
    audioTrack.enabled = false
    document.getElementById('mic-btn').style.backgroundColor = 'rgb(255, 80, 80)'
  } else {
    audioTrack.enabled = true
    document.getElementById('mic-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
  }
}

window.addEventListener('beforeunload', leaveChannel)

document.getElementById('camera-btn').addEventListener('click', toggleCamera)
document.getElementById('mic-btn').addEventListener('click', toggleMic)

// Calling the initialization function to start the process
init()
