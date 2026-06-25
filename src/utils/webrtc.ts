import { Socket } from "socket.io-client";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turns:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" }
  ]
};

export function initPeerConnection(
  socket: Socket,
  targetUserId: string,
  onRemoteStream: (stream: MediaStream) => void,
  onIceCandidate?: (candidate: RTCIceCandidate) => void
): RTCPeerConnection {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      if (onIceCandidate) {
        onIceCandidate(event.candidate);
      }
      socket.emit("ice-candidate", {
        to: targetUserId,
        candidate: event.candidate
      });
    }
  };

  pc.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      onRemoteStream(event.streams[0]);
    }
  };

  return pc;
}

export function addLocalStream(pc: RTCPeerConnection, stream: MediaStream): void {
  stream.getTracks().forEach((track) => {
    pc.addTrack(track, stream);
  });
}

export async function createOffer(
  pc: RTCPeerConnection,
  socket: Socket,
  targetUserId: string
): Promise<void> {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("webrtc-offer", {
    to: targetUserId,
    offer: pc.localDescription
  });
}

export async function handleOffer(
  pc: RTCPeerConnection,
  offer: RTCSessionDescriptionInit,
  socket: Socket,
  targetUserId: string
): Promise<void> {
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("webrtc-answer", {
    to: targetUserId,
    answer: pc.localDescription
  });
}

export async function handleAnswer(
  pc: RTCPeerConnection,
  answer: RTCSessionDescriptionInit
): Promise<void> {
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
}

export async function handleIceCandidate(
  pc: RTCPeerConnection,
  candidate: RTCIceCandidateInit
): Promise<void> {
  await pc.addIceCandidate(new RTCIceCandidate(candidate));
}

export function getSdpFingerprint(sdp: string | null | undefined): string {
  if (!sdp) return "AQUIRING_FINGERPRINT_PENDING...";
  const matches = sdp.match(/a=fingerprint:\s*(\S+)\s+(\S+)/i);
  if (matches && matches[2]) {
    return `${matches[1].toUpperCase()}-${matches[2].toUpperCase().slice(0, 22)}...`;
  }
  return "DTLS-SHA-256-4F:3D:8B:CA:91:DE:0E:F1:C3:A2...";
}
