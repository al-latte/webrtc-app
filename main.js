import './style.css'

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, addDoc, updateDoc, onSnapshot } from 'firebase/firestore';
// import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'wrtc';

const firebaseConfig = {
  apiKey: "AIzaSyCfryL6ivLNmc_MfwKNfBAyeJTDrM7_BFg",
  authDomain: "webrtc-demo-7fd0c.firebaseapp.com",
  projectId: "webrtc-demo-7fd0c",
  storageBucket: "webrtc-demo-7fd0c.appspot.com",
  messagingSenderId: "69993378117",
  appId: "1:69993378117:web:61851f31e9878304328e2c"
};

// Initialize Firebase app
const firebaseApp = initializeApp(firebaseConfig);
const firestore = getFirestore(firebaseApp);

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.1.google.com:19302', 'stun:stun2.1.google.com:19302']
    },
  ],
  iceCandidatePoolSize: 10,
}

// Global State
let pc = new RTCPeerConnection(servers)
let localStream = null 
let remoteStream = null

const webcamButton = document.getElementById('webcamButton')
const webcamVideo = document.getElementById('webcamVideo')
const callButton = document.getElementById('callButton')
const callInput = document.getElementById('callInput')
const answerButton = document.getElementById('answerButton')
const remoteVideo = document.getElementById('remoteVideo')
const hangupButton = document.getElementById('hangupButton')

// Setup media sources
webcamButton.onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true})
  remoteStream = new MediaStream()

  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream)
  })

  pc.ontrack = event => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track)
    })
  }

  webcamVideo.srcObject = localStream
  remoteVideo.srcObject = remoteStream
}


// Create an offer
callButton.onclick = async () => {
  const callDocRef = await addDoc(collection(firestore, 'calls'), { offer: null })

  const offerCandidatesRef = collection(callDocRef, 'offerCandidates')
  const answerCandidatesRef = collection(callDocRef, 'answerCandidates')

  callInput.value = callDocRef.id
  
  pc.onicecandidate = event => {
    event.candidate && addDoc(offerCandidatesRef, event.candidate.toJSON())
  }

  const offerDescription = await pc.createOffer()
  await pc.setLocalDescription(offerDescription)

  await updateDoc(callDocRef, { offer: { sdp: offerDescription.sdp, type: offerDescription.type } })

  onSnapshot(callDocRef, (snapshot) => {
    const data = snapshot.data()
    if (!pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer)
      pc.setRemoteDescription(answerDescription)
    }
  })

  onSnapshot(answerCandidatesRef, (snapshot) => { // Use onSnapshot() here
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data())
        pc.addIceCandidate(candidate)
      }
    })
  })
}


// Answer the call with the unique ID
answerButton.onclick = async () => {
  const callId = callInput.value
  const callDocRef = doc(firestore, 'calls', callId)
  const answerCandidatesRef = collection(callDocRef, 'answerCandidates')

  pc.onicecandidate = event => {
    event.candidate && addDoc(answerCandidatesRef, event.candidate.toJSON())
  }

  const callDocSnapshot = await getDoc(callDocRef)
  const callData = callDocSnapshot.data()

  const offerDescription = callData.offer
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription))

  const answerDescription = await pc.createAnswer()
  await pc.setLocalDescription(answerDescription)

  await updateDoc(callDocRef, { answer: { sdp: answerDescription.sdp, type: answerDescription.type } })

  const offerCandidatesRef = collection(callDocRef, 'offerCandidates')
  onSnapshot(offerCandidatesRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data())
        pc.addIceCandidate(candidate)
      }
    })
  })
}
