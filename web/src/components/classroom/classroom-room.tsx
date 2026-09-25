"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ClassroomChat } from "@/components/classroom/classroom-chat";
import { ClassroomFiles } from "@/components/classroom/classroom-files";
import { ClassroomNotes } from "@/components/classroom/classroom-notes";
import { ClassroomLessonTimer } from "@/components/classroom/classroom-lesson-timer";
import {
  ClassroomRecordingClock,
  ClassroomRecordingNotice,
} from "@/components/classroom/classroom-recording";
import { ClassroomRecordingLibrary } from "@/components/classroom/classroom-recording-library";
import { ClassroomSpeechCaptions } from "@/components/classroom/classroom-speech-captions";
import { ClassroomPresentationStage } from "@/components/classroom/classroom-presentation";
import { ClassroomMediaControls } from "@/components/classroom/classroom-media-controls";
import { ClassroomMediaTile } from "@/components/classroom/classroom-media-tile";
import { ClassroomOverlay } from "@/components/classroom/classroom-overlay";
import {
  applyClassroomPointer,
  ClassroomWhiteboard,
} from "@/components/classroom/classroom-whiteboard";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { ApiClientError, deleteJson, getJson, postJson } from "@/lib/api";
import type { BrandProfile } from "@/lib/brand";
import type { ClassroomOverlay as Overlay } from "@/lib/classroom-brand";
import {
  classroomTileGridClass,
  mergeClassroomMessages,
  parseClassroomChatMessage,
  sortClassroomParticipants,
} from "@/lib/classroom";
import {
  mergeClassroomFiles,
  parseClassroomSharedFile,
} from "@/lib/classroom-files";
import { parseClassroomPresentation } from "@/lib/classroom-pptx";
import {
  classroomRoleCanAnnotate,
  parseClassroomWhiteboard,
  parseClassroomWhiteboardPointer,
  type ClassroomWhiteboardInput,
  type ClassroomWhiteboardPointer,
} from "@/lib/classroom-whiteboard";
import {
  CLASSROOM_AUDIO_CONSTRAINTS,
  CLASSROOM_ICE,
  CLASSROOM_VIDEO_CONSTRAINTS,
  classroomMediaAllowed,
  classroomMediaAttempts,
  listClassroomDevices,
  markScreenTrack,
  mediaFlagsFromStream,
  parseClassroomMediaControl,
  startSpeakingMonitor,
  trackDeviceId,
  type ClassroomMediaFlags,
} from "@/lib/classroom-media";
import {
  collectClassroomRecordingStreams,
  createClassroomMediaRecorder,
  formatClassroomRecordingTime,
  startClassroomRecordingMix,
} from "@/lib/classroom-recording";
import type { UiMessageKey } from "@/lib/i18n";
import type { ClassroomSessionView } from "@/server/classroom/service";
import type { ClassroomWhiteboardDocument } from "@/db/schema/classrooms";

type SyncPayload = {
  participants: ClassroomSessionView["participants"];
  messages: ClassroomSessionView["messages"];
  whiteboard: ClassroomWhiteboardDocument;
  signals: {
    id: string;
    type: "offer" | "answer" | "ice" | "hangup" | "control" | "chat" | "file" | "whiteboard" | "pointer" | "presentation" | "recording";
    fromUserId: string;
    toUserId: string;
    payload: unknown;
  }[];
  files: ClassroomSessionView["files"];
  presentation: ClassroomSessionView["presentation"];
  recording: ClassroomSessionView["recording"];
  recordings?: ClassroomSessionView["recordings"];
  retentionDays?: number;
};

function playVideo(node: HTMLVideoElement | null) {
  if (!node) return;
  void node.play().catch(() => {
    // autoplay can wait for the next user gesture
  });
}

function applyWhiteboard(
  current: ClassroomSessionView,
  board: ClassroomWhiteboardDocument,
): ClassroomSessionView {
  return {
    ...current,
    whiteboard: board,
    self: {
      ...current.self,
      canDraw: classroomRoleCanAnnotate(current.self.role, board),
    },
  };
}

export function ClassroomRoom({
  initial,
  brand,
  overlay,
  leaveHref,
}: {
  initial: ClassroomSessionView;
  brand: BrandProfile;
  overlay: Overlay;
  leaveHref: string;
}) {
  const t = useT();
  const [session, setSession] = useState(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mediaReady, setMediaReady] = useState(false);
  const [startingMedia, setStartingMedia] = useState(false);
  const [localFlags, setLocalFlags] = useState<ClassroomMediaFlags>({
    cameraOn: false,
    micOn: false,
  });
  const [remoteFlags, setRemoteFlags] = useState<Record<string, ClassroomMediaFlags>>({});
  const [peerState, setPeerState] = useState<Record<string, RTCPeerConnectionState>>({});
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({});
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [micId, setMicId] = useState("");
  const [localSharing, setLocalSharing] = useState(false);
  const [remoteScreens, setRemoteScreens] = useState<Record<string, boolean>>({});
  const [sendingChat, setSendingChat] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [pointers, setPointers] = useState<ClassroomWhiteboardPointer[]>([]);
  const [stayWithClass, setStayWithClass] = useState(false);
  const [savingRecording, setSavingRecording] = useState(false);
  const localVideo = useRef<HTMLVideoElement>(null);
  const localScreen = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const screenTracks = useRef(new WeakSet<MediaStreamTrack>());
  const screenSharingRef = useRef(false);
  const peers = useRef(new Map<string, RTCPeerConnection>());
  const remoteNodes = useRef(new Map<string, HTMLVideoElement>());
  const remoteStreams = useRef(new Map<string, MediaStream>());
  const screenNodes = useRef(new Map<string, HTMLVideoElement>());
  const remoteScreenStreams = useRef(new Map<string, MediaStream>());
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const speakingStop = useRef(new Map<string, () => void>());
  const flagsRef = useRef(localFlags);
  const startedMedia = useRef(false);
  const lastMessageAt = useRef(initial.messages.at(-1)?.createdAt);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const mixStopRef = useRef<(() => void) | null>(null);
  const recordingIdRef = useRef<string | null>(null);
  const uploadQueue = useRef(Promise.resolve());
  const capturingRef = useRef(false);
  const stoppingRef = useRef(false);
  const mediaActions = useRef<{
    setMicEnabled: (enabled: boolean, source?: "self" | "teacher") => Promise<void>;
    setCameraEnabled: (enabled: boolean, source?: "self" | "teacher") => Promise<void>;
    stopScreen: (source?: "self" | "teacher") => Promise<void>;
  }>({
    setMicEnabled: async () => {},
    setCameraEnabled: async () => {},
    stopScreen: async () => {},
  });
  const selfId = session.self.userId;
  const canControlMedia = session.self.canControlMedia;

  const people = useMemo(
    () => sortClassroomParticipants(session.participants),
    [session.participants],
  );
  const others = useMemo(
    () => people.filter((item) => item.userId !== selfId && item.present),
    [people, selfId],
  );
  const presentCount = people.filter((item) => item.present).length;
  const waitingCount = people.length - presentCount;
  const teacherId = people.find((item) => item.role === "teacher")?.userId;
  const sharer = people.find(
    (item) =>
      item.present &&
      (item.screenSharing ||
        remoteScreens[item.userId] ||
        (item.userId === selfId && localSharing)),
  );

  useEffect(() => {
    lastMessageAt.current = session.messages.at(-1)?.createdAt;
  }, [session.messages]);

  const sendSignal = useCallback(
    async (
      type: "offer" | "answer" | "ice" | "hangup",
      toUserId: string,
      payload: unknown,
    ) => {
      await postJson(`/api/v1/classrooms/${session.classroom.id}/signals`, {
        type,
        toUserId,
        payload,
      });
    },
    [session.classroom.id],
  );

  const sendHeartbeat = useCallback(
    async (flags = flagsRef.current) => {
      await postJson(`/api/v1/classrooms/${session.classroom.id}/heartbeat`, {
        ...flags,
        screenSharing: screenSharingRef.current,
      });
    },
    [session.classroom.id],
  );

  const applyLocalFlags = useCallback(
    (flags: ClassroomMediaFlags, extraNotice = "") => {
      flagsRef.current = flags;
      setLocalFlags(flags);
      setNotice(extraNotice);
      void sendHeartbeat(flags);
    },
    [sendHeartbeat],
  );

  const refreshDevices = useCallback(async () => {
    const next = await listClassroomDevices();
    setCameras(next.cameras);
    setMics(next.mics);
    setCameraId(trackDeviceId(streamRef.current, "video") || next.cameras[0]?.deviceId || "");
    setMicId(trackDeviceId(streamRef.current, "audio") || next.mics[0]?.deviceId || "");
  }, []);

  const replaceSenderTrack = useCallback(
    (kind: "audio" | "video", track: MediaStreamTrack | null) => {
      for (const peer of peers.current.values()) {
        const sender = peer.getSenders().find(
          (item) =>
            item.track?.kind === kind && !screenTracks.current.has(item.track),
        );
        if (sender) {
          void sender.replaceTrack(track);
        } else if (track && streamRef.current) {
          peer.addTrack(track, streamRef.current);
        }
      }
    },
    [],
  );

  const setMicEnabled = useCallback(
    async (enabled: boolean, source: "self" | "teacher" = "self") => {
      const stream = streamRef.current;
      if (!stream) return;
      for (const track of stream.getAudioTracks()) {
        track.enabled = enabled;
      }
      applyLocalFlags(
        mediaFlagsFromStream(stream),
        source === "teacher" && !enabled ? t("classroom.teacher_muted") : "",
      );
    },
    [applyLocalFlags, t],
  );

  const setCameraEnabled = useCallback(
    async (enabled: boolean, source: "self" | "teacher" = "self") => {
      const stream = streamRef.current;
      if (!enabled) {
        if (!stream) return;
        for (const track of stream.getVideoTracks()) {
          track.stop();
          stream.removeTrack(track);
        }
        replaceSenderTrack("video", null);
        if (localVideo.current) {
          localVideo.current.srcObject = stream;
        }
        applyLocalFlags(
          mediaFlagsFromStream(stream),
          source === "teacher" ? t("classroom.teacher_camera_off") : "",
        );
        return;
      }
      if (!classroomMediaAllowed()) {
        setError(t("classroom.media_insecure"));
        return;
      }
      try {
        const video = await navigator.mediaDevices.getUserMedia({
          video: {
            ...CLASSROOM_VIDEO_CONSTRAINTS,
            ...(cameraId ? { deviceId: { exact: cameraId } } : {}),
          },
          audio: false,
        });
        const [track] = video.getVideoTracks();
        if (!track) return;
        const next = stream ?? new MediaStream();
        for (const old of next.getVideoTracks()) {
          old.stop();
          next.removeTrack(old);
        }
        next.addTrack(track);
        streamRef.current = next;
        if (localVideo.current) {
          localVideo.current.srcObject = next;
          playVideo(localVideo.current);
        }
        replaceSenderTrack("video", track);
        applyLocalFlags(mediaFlagsFromStream(next));
        await refreshDevices();
      } catch {
        setError(t("classroom.media_failed"));
      }
    },
    [applyLocalFlags, cameraId, refreshDevices, replaceSenderTrack, t],
  );

  const stopShare = useCallback(
    async (source: "self" | "teacher" = "self") => {
      const stream = screenRef.current;
      screenRef.current = null;
      screenSharingRef.current = false;
      setLocalSharing(false);
      if (localScreen.current) {
        localScreen.current.srcObject = null;
      }
      for (const track of stream?.getTracks() ?? []) {
        track.stop();
        for (const peer of peers.current.values()) {
          const sender = peer.getSenders().find((item) => item.track === track);
          if (sender) {
            peer.removeTrack(sender);
          }
        }
      }
      void sendHeartbeat();
      if (source === "teacher") {
        setNotice(t("classroom.share_stopped_by_teacher"));
      }
    },
    [sendHeartbeat, t],
  );

  useEffect(() => {
    mediaActions.current = { setMicEnabled, setCameraEnabled, stopScreen: stopShare };
  }, [setCameraEnabled, setMicEnabled, stopShare]);

  const controlRemote = useCallback(
    async (
      targetUserId: string,
      action: "mute" | "camera_off" | "screen_off",
    ) => {
      try {
        await postJson(`/api/v1/classrooms/${session.classroom.id}/media`, {
          targetUserId,
          action,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : t("classroom.control_failed"));
      }
    },
    [session.classroom.id, t],
  );

  const muteAll = useCallback(async () => {
    const targets = people.filter(
      (item) =>
        item.present &&
        item.userId !== selfId &&
        item.role !== "teacher" &&
        (remoteFlags[item.userId]?.micOn ?? item.micOn),
    );
    await Promise.all(targets.map((item) => controlRemote(item.userId, "mute")));
  }, [controlRemote, people, remoteFlags, selfId]);

  const watchSpeaking = useCallback((userId: string, stream: MediaStream) => {
    speakingStop.current.get(userId)?.();
    speakingStop.current.set(
      userId,
      startSpeakingMonitor(stream, (active) => {
        setSpeaking((current) =>
          current[userId] === active ? current : { ...current, [userId]: active },
        );
      }),
    );
  }, []);

  const switchDevice = useCallback(
    async (kind: "audio" | "video", deviceId: string) => {
      if (!deviceId || !streamRef.current) return;
      if (kind === "video" && !flagsRef.current.cameraOn) {
        setCameraId(deviceId);
        return;
      }
      try {
        const next = await navigator.mediaDevices.getUserMedia(
          kind === "video"
            ? {
                video: { ...CLASSROOM_VIDEO_CONSTRAINTS, deviceId: { exact: deviceId } },
                audio: false,
              }
            : {
                audio: { ...CLASSROOM_AUDIO_CONSTRAINTS, deviceId: { exact: deviceId } },
                video: false,
              },
        );
        const [track] =
          kind === "video" ? next.getVideoTracks() : next.getAudioTracks();
        if (!track) return;
        const stream = streamRef.current;
        for (const old of kind === "video" ? stream.getVideoTracks() : stream.getAudioTracks()) {
          old.stop();
          stream.removeTrack(old);
        }
        if (kind === "audio") {
          track.enabled = flagsRef.current.micOn;
        }
        stream.addTrack(track);
        replaceSenderTrack(kind, track);
        if (kind === "video" && localVideo.current) {
          localVideo.current.srcObject = stream;
          playVideo(localVideo.current);
        }
        if (kind === "audio") {
          watchSpeaking(selfId, stream);
        }
        applyLocalFlags(mediaFlagsFromStream(stream));
        if (kind === "video") setCameraId(deviceId);
        else setMicId(deviceId);
      } catch {
        setError(t("classroom.media_failed"));
      }
    },
    [applyLocalFlags, replaceSenderTrack, selfId, t, watchSpeaking],
  );

  const dropPeer = useCallback((userId: string) => {
    const peer = peers.current.get(userId);
    if (peer) {
      peer.close();
      peers.current.delete(userId);
    }
    pendingIce.current.delete(userId);
    speakingStop.current.get(userId)?.();
    speakingStop.current.delete(userId);
    remoteStreams.current.delete(userId);
    remoteScreenStreams.current.delete(userId);
    const node = remoteNodes.current.get(userId);
    if (node) node.srcObject = null;
    const screen = screenNodes.current.get(userId);
    if (screen) screen.srcObject = null;
    setRemoteScreens((current) => {
      if (!current[userId]) return current;
      const next = { ...current };
      delete next[userId];
      return next;
    });
    setRemoteFlags((current) => {
      if (!(userId in current)) return current;
      const next = { ...current };
      delete next[userId];
      return next;
    });
    setPeerState((current) => {
      if (!(userId in current)) return current;
      const next = { ...current };
      delete next[userId];
      return next;
    });
    setSpeaking((current) => {
      if (!(userId in current)) return current;
      const next = { ...current };
      delete next[userId];
      return next;
    });
  }, []);

  const attachRemote = useCallback(
    (userId: string, incoming: MediaStream) => {
      remoteStreams.current.set(userId, incoming);
      const node = remoteNodes.current.get(userId);
      if (node && node.srcObject !== incoming) {
        node.srcObject = incoming;
        playVideo(node);
      }
      setRemoteFlags((current) => ({
        ...current,
        [userId]: mediaFlagsFromStream(incoming),
      }));
      watchSpeaking(userId, incoming);
    },
    [watchSpeaking],
  );

  const bindRemoteVideo = useCallback(
    (userId: string, node: HTMLVideoElement | null) => {
      if (node) {
        remoteNodes.current.set(userId, node);
        const incoming = remoteStreams.current.get(userId);
        if (incoming && node.srcObject !== incoming) {
          node.srcObject = incoming;
          playVideo(node);
        }
      } else {
        remoteNodes.current.delete(userId);
      }
    },
    [],
  );

  const bindRemoteScreen = useCallback(
    (userId: string, node: HTMLVideoElement | null) => {
      if (node) {
        screenNodes.current.set(userId, node);
        const incoming = remoteScreenStreams.current.get(userId);
        if (incoming && node.srcObject !== incoming) {
          node.srcObject = incoming;
          playVideo(node);
        }
      } else {
        screenNodes.current.delete(userId);
      }
    },
    [],
  );

  const flushIce = useCallback(async (userId: string) => {
    const peer = peers.current.get(userId);
    const queued = pendingIce.current.get(userId) ?? [];
    pendingIce.current.delete(userId);
    if (!peer) return;
    for (const candidate of queued) {
      try {
        await peer.addIceCandidate(candidate);
      } catch {
        // late ice
      }
    }
  }, []);

  const addLocalTracks = useCallback((peer: RTCPeerConnection) => {
    const publish = (stream: MediaStream | null) => {
      if (!stream) return;
      for (const track of stream.getTracks()) {
        if (!peer.getSenders().some((item) => item.track === track)) {
          peer.addTrack(track, stream);
        }
      }
    };
    publish(streamRef.current);
    publish(screenRef.current);
  }, []);

  const ensurePeer = useCallback(
    (userId: string) => {
      const existing = peers.current.get(userId);
      if (existing) return existing;
      const peer = new RTCPeerConnection(CLASSROOM_ICE);
      addLocalTracks(peer);
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          void sendSignal("ice", userId, event.candidate.toJSON());
        }
      };
      peer.ontrack = (event) => {
        const incoming = event.streams[0] ?? new MediaStream([event.track]);
        const existing = remoteStreams.current.get(userId);
        const isScreen =
          event.track.kind === "video" &&
          (event.track.contentHint === "detail" ||
            Boolean(
              existing &&
                existing !== incoming &&
                existing.getVideoTracks().length,
            ));
        if (isScreen) {
          remoteScreenStreams.current.set(userId, incoming);
          const node = screenNodes.current.get(userId);
          if (node && node.srcObject !== incoming) {
            node.srcObject = incoming;
            playVideo(node);
          }
          setRemoteScreens((current) =>
            current[userId] ? current : { ...current, [userId]: true },
          );
          event.track.onended = () => {
            remoteScreenStreams.current.delete(userId);
            const screen = screenNodes.current.get(userId);
            if (screen) screen.srcObject = null;
            setRemoteScreens((current) => {
              if (!current[userId]) return current;
              const next = { ...current };
              delete next[userId];
              return next;
            });
          };
          return;
        }
        event.track.onmute = () => {
          setRemoteFlags((current) => ({
            ...current,
            [userId]: mediaFlagsFromStream(incoming),
          }));
        };
        event.track.onunmute = () => {
          setRemoteFlags((current) => ({
            ...current,
            [userId]: mediaFlagsFromStream(incoming),
          }));
        };
        event.track.onended = () => {
          setRemoteFlags((current) => ({
            ...current,
            [userId]: mediaFlagsFromStream(incoming),
          }));
        };
        attachRemote(userId, incoming);
      };
      peer.onconnectionstatechange = () => {
        setPeerState((current) => ({ ...current, [userId]: peer.connectionState }));
      };
      peers.current.set(userId, peer);
      return peer;
    },
    [addLocalTracks, attachRemote, sendSignal],
  );

  const offerTo = useCallback(
    async (userId: string) => {
      const peer = ensurePeer(userId);
      addLocalTracks(peer);
      if (peer.signalingState !== "stable") return;
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await sendSignal("offer", userId, offer);
    },
    [addLocalTracks, ensurePeer, sendSignal],
  );

  const publishToPeers = useCallback(async () => {
    for (const person of others) {
      const peer = peers.current.get(person.userId);
      if (peer) {
        addLocalTracks(peer);
        if (peer.signalingState === "stable") {
          await offerTo(person.userId);
        }
      } else if (selfId > person.userId) {
        await offerTo(person.userId);
      }
    }
  }, [addLocalTracks, offerTo, others, selfId]);

  const startShare = useCallback(async () => {
    setError("");
    if (!classroomMediaAllowed()) {
      setError(t("classroom.media_insecure"));
      return;
    }
    if (screenRef.current) {
      await stopShare();
    }
    const other = people.find(
      (item) =>
        item.present &&
        item.userId !== selfId &&
        (item.screenSharing || remoteScreens[item.userId]),
    );
    if (other) {
      if (canControlMedia) {
        await controlRemote(other.userId, "screen_off");
      } else {
        setError(t("classroom.share_taken"));
        return;
      }
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15 } },
        audio: false,
      });
      const [track] = stream.getVideoTracks();
      if (!track) return;
      markScreenTrack(track);
      screenTracks.current.add(track);
      screenRef.current = stream;
      if (localScreen.current) {
        localScreen.current.srcObject = stream;
        playVideo(localScreen.current);
      }
      track.onended = () => {
        void stopShare();
      };
      for (const peer of peers.current.values()) {
        if (!peer.getSenders().some((item) => item.track === track)) {
          peer.addTrack(track, stream);
        }
      }
      screenSharingRef.current = true;
      setLocalSharing(true);
      void sendHeartbeat();
      await publishToPeers();
    } catch {
      screenRef.current?.getTracks().forEach((track) => track.stop());
      screenRef.current = null;
      screenSharingRef.current = false;
      setLocalSharing(false);
      setError(t("classroom.share_failed"));
    }
  }, [
    canControlMedia,
    controlRemote,
    people,
    publishToPeers,
    remoteScreens,
    selfId,
    sendHeartbeat,
    stopShare,
    t,
  ]);

  const handleSignal = useCallback(
    async (signal: SyncPayload["signals"][number]) => {
      if (signal.type === "hangup") {
        dropPeer(signal.fromUserId);
        return;
      }
      if (signal.type === "pointer") {
        const point = parseClassroomWhiteboardPointer(signal.payload);
        if (point) {
          setPointers((current) =>
            applyClassroomPointer(current, {
              ...point,
              userId: signal.fromUserId,
              at: Date.now(),
            }),
          );
        }
        return;
      }
      if (signal.type === "whiteboard") {
        const board = parseClassroomWhiteboard(signal.payload);
        if (board) {
          setSession((current) => applyWhiteboard(current, board));
        }
        return;
      }
      if (signal.type === "presentation") {
        const payload = signal.payload as { presentation?: unknown };
        setSession((current) => ({
          ...current,
          presentation: parseClassroomPresentation(payload.presentation),
        }));
        return;
      }
      if (signal.type === "recording") {
        const payload = signal.payload as { recording?: ClassroomSessionView["recording"] };
        setSession((current) => ({
          ...current,
          recording: payload.recording ?? null,
        }));
        return;
      }
      if (signal.type === "file") {
        const payload = signal.payload as { action?: unknown; file?: unknown };
        const file = parseClassroomSharedFile(payload.file);
        if (!file) return;
        setSession((current) => ({
          ...current,
          files:
            payload.action === "removed"
              ? current.files.filter((item) => item.id !== file.id)
              : mergeClassroomFiles(current.files, [file]),
        }));
        return;
      }
      if (signal.type === "chat") {
        const message = parseClassroomChatMessage(signal.payload);
        if (message) {
          setSession((current) => ({
            ...current,
            messages: mergeClassroomMessages(current.messages, [
              { ...message, role: message.role ?? "student" },
            ]),
          }));
        }
        return;
      }
      if (signal.type === "control") {
        const action = parseClassroomMediaControl(signal.payload);
        if (action === "mute") {
          void mediaActions.current.setMicEnabled(false, "teacher");
        } else if (action === "camera_off") {
          void mediaActions.current.setCameraEnabled(false, "teacher");
        } else if (action === "screen_off") {
          void mediaActions.current.stopScreen("teacher");
        }
        return;
      }
      const peer = ensurePeer(signal.fromUserId);
      if (signal.type === "offer") {
        if (peer.signalingState === "have-local-offer") {
          if (selfId < signal.fromUserId) {
            try {
              await peer.setLocalDescription({ type: "rollback" });
            } catch {
              return;
            }
          } else {
            return;
          }
        }
        await peer.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
        await flushIce(signal.fromUserId);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await sendSignal("answer", signal.fromUserId, answer);
      } else if (signal.type === "answer") {
        if (peer.signalingState === "have-local-offer") {
          await peer.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
          await flushIce(signal.fromUserId);
        }
      } else if (signal.type === "ice") {
        const candidate = signal.payload as RTCIceCandidateInit;
        if (!peer.remoteDescription) {
          const queued = pendingIce.current.get(signal.fromUserId) ?? [];
          queued.push(candidate);
          pendingIce.current.set(signal.fromUserId, queued);
          return;
        }
        try {
          await peer.addIceCandidate(candidate);
        } catch {
          // late ice
        }
      }
    },
    [dropPeer, ensurePeer, flushIce, selfId, sendSignal],
  );

  useEffect(() => {
    let cancelled = false;
    const classroomId = session.classroom.id;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const after = lastMessageAt.current;
          const next = await getJson<SyncPayload>(
            after
              ? `/api/v1/classrooms/${classroomId}/sync?after=${encodeURIComponent(after)}`
              : `/api/v1/classrooms/${classroomId}/sync`,
          );
          if (cancelled) return;
          setSession((current) => ({
            ...applyWhiteboard(current, next.whiteboard),
            participants: next.participants,
            messages: mergeClassroomMessages(current.messages, next.messages),
            files: next.files ?? current.files,
            presentation:
              next.presentation !== undefined
                ? next.presentation
                : current.presentation,
            recording: next.recording,
            recordings: next.recordings ?? current.recordings,
            retentionDays: next.retentionDays ?? current.retentionDays,
          }));
          for (const signal of next.signals) {
            await handleSignal(signal);
          }
          const liveIds = new Set(
            next.participants
              .filter((item) => item.present && item.userId !== selfId)
              .map((item) => item.userId),
          );
          for (const userId of peers.current.keys()) {
            if (!liveIds.has(userId)) dropPeer(userId);
          }
          for (const person of next.participants) {
            if (!person.present || person.userId === selfId) continue;
            if (!peers.current.has(person.userId) && selfId > person.userId) {
              await offerTo(person.userId);
            }
          }
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : t("classroom.sync_failed"));
          }
        }
      })();
    }, 2500);
    const beat = window.setInterval(() => {
      void sendHeartbeat();
    }, 12000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearInterval(beat);
    };
  }, [dropPeer, handleSignal, offerTo, selfId, sendHeartbeat, session.classroom.id, t]);

  useEffect(() => {
    const connections = peers.current;
    const monitors = speakingStop.current;
    return () => {
      recorderRef.current?.stop();
      mixStopRef.current?.();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      screenRef.current?.getTracks().forEach((track) => track.stop());
      for (const stop of monitors.values()) stop();
      monitors.clear();
      for (const peer of connections.values()) peer.close();
      connections.clear();
    };
  }, []);

  const enableMedia = useCallback(async () => {
    setError("");
    setNotice("");
    if (!session.self.canPublish) {
      setMediaReady(true);
      startedMedia.current = true;
      await publishToPeers();
      return;
    }
    if (!classroomMediaAllowed()) {
      setError(t("classroom.media_insecure"));
      return;
    }
    setStartingMedia(true);
    try {
      let stream: MediaStream | null = null;
      let lastError: unknown;
      for (const constraints of classroomMediaAttempts(true)) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (err) {
          lastError = err;
        }
      }
      if (!stream) {
        throw lastError instanceof Error
          ? lastError
          : new Error(t("classroom.media_failed"));
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      if (localVideo.current) {
        localVideo.current.srcObject = stream;
        playVideo(localVideo.current);
      }
      const flags = mediaFlagsFromStream(stream);
      applyLocalFlags(
        flags,
        flags.cameraOn ? "" : t("classroom.media_audio_only"),
      );
      watchSpeaking(selfId, stream);
      setMediaReady(true);
      startedMedia.current = true;
      await refreshDevices();
      await publishToPeers();
    } catch {
      setError(t("classroom.media_failed"));
    } finally {
      setStartingMedia(false);
    }
  }, [applyLocalFlags, publishToPeers, refreshDevices, selfId, session.self.canPublish, t, watchSpeaking]);

  useEffect(() => {
    if (startedMedia.current) return;
    startedMedia.current = true;
    void enableMedia();
  }, [enableMedia]);

  function bindLocalVideo(node: HTMLVideoElement | null) {
    localVideo.current = node;
    if (node && streamRef.current && node.srcObject !== streamRef.current) {
      node.srcObject = streamRef.current;
      playVideo(node);
    }
  }

  function bindLocalScreen(node: HTMLVideoElement | null) {
    localScreen.current = node;
    if (node && screenRef.current && node.srcObject !== screenRef.current) {
      node.srcObject = screenRef.current;
      playVideo(node);
    }
  }

  async function updateBoard(input: ClassroomWhiteboardInput) {
    try {
      const result = await postJson<{
        whiteboard: ClassroomWhiteboardDocument;
        presentation?: ClassroomSessionView["presentation"];
      }>(
        `/api/v1/classrooms/${session.classroom.id}/whiteboard`,
        input,
      );
      if (!input.pointer) {
        setSession((current) => {
          const next = applyWhiteboard(current, result.whiteboard);
          return {
            ...next,
            presentation:
              result.presentation !== undefined
                ? result.presentation
                : next.presentation,
          };
        });
        if (input.annotateFileId || input.followPage || input.addPage) {
          setStayWithClass(true);
        }
      }
    } catch (err) {
      if (input.pointer) return;
      setError(
        err instanceof ApiClientError && err.code === "CONTACT_BLOCKED"
          ? t("classroom.board_contact")
          : err instanceof Error
            ? err.message
            : t("classroom.board_failed"),
      );
      throw err;
    }
  }

  const updatePresentation = useCallback(
    async (input: {
      action: "open" | "close" | "goto" | "bookmark" | "lock";
      fileId?: string;
      slideIndex?: number;
      followLocked?: boolean;
    }) => {
      setError("");
      try {
        const result = await postJson<{
          presentation: ClassroomSessionView["presentation"];
        }>(`/api/v1/classrooms/${session.classroom.id}/presentation`, input);
        setSession((current) => ({
          ...current,
          presentation: result.presentation,
        }));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("classroom.slides_failed"),
        );
      }
    },
    [session.classroom.id, t],
  );

  async function uploadBoardImage(file: File) {
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(
        `/api/v1/classrooms/${session.classroom.id}/files`,
        { method: "POST", credentials: "include", body },
      );
      const json = (await response.json()) as
        | { ok: true; data: ClassroomSessionView["files"][number] }
        | { ok: false; error?: { code?: string; message?: string } };
      if (!response.ok || !json.ok) {
        throw new ApiClientError(
          !json.ok
            ? json.error?.message || t("classroom.board_image_failed")
            : t("classroom.board_image_failed"),
          !json.ok ? json.error?.code : undefined,
        );
      }
      setSession((current) => ({
        ...current,
        files: mergeClassroomFiles(current.files, [json.data]),
      }));
      return json.data;
    } catch (err) {
      setError(
        err instanceof ApiClientError && err.code === "CONTACT_BLOCKED"
          ? t("classroom.files_contact")
          : err instanceof Error
            ? err.message
            : t("classroom.board_image_failed"),
      );
      throw err;
    }
  }

  async function sendMessage() {
    const body = draft.trim();
    if (!body || sendingChat) return;
    setDraft("");
    setSendingChat(true);
    setError("");
    try {
      const message = await postJson<ClassroomSessionView["messages"][number]>(
        `/api/v1/classrooms/${session.classroom.id}/messages`,
        { body },
      );
      setSession((current) => ({
        ...current,
        messages: mergeClassroomMessages(current.messages, [message]),
      }));
    } catch (err) {
      setDraft(body);
      setError(
        err instanceof ApiClientError && err.code === "CONTACT_BLOCKED"
          ? t("classroom.chat_contact")
          : err instanceof Error
            ? err.message
            : t("classroom.chat_failed"),
      );
    } finally {
      setSendingChat(false);
    }
  }

  const uploadRecordingChunk = useCallback(
    async (recordingId: string, blob: Blob) => {
      const body = new FormData();
      body.append("recordingId", recordingId);
      body.append("chunk", blob, "chunk.webm");
      if (blob.type) body.append("mimeType", blob.type);
      const response = await fetch(
        `/api/v1/classrooms/${session.classroom.id}/recording/chunks`,
        { method: "POST", credentials: "include", body },
      );
      const json = (await response.json()) as
        | { ok: true }
        | { ok: false; error?: { message?: string } };
      if (!response.ok || !json.ok) {
        throw new Error(
          !json.ok ? json.error?.message || t("classroom.record_failed") : t("classroom.record_failed"),
        );
      }
    },
    [session.classroom.id, t],
  );

  const stopCapture = useCallback(async () => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    capturingRef.current = false;
    recordingIdRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        recorder.addEventListener("stop", () => resolve(), { once: true });
        recorder.stop();
      });
    }
    mixStopRef.current?.();
    mixStopRef.current = null;
    await uploadQueue.current.catch(() => undefined);
  }, []);

  const beginCapture = useCallback(
    async (recordingId: string) => {
      if (recorderRef.current || capturingRef.current) return;
      const inputs = collectClassroomRecordingStreams([
        streamRef.current,
        screenRef.current,
        ...remoteStreams.current.values(),
        ...remoteScreenStreams.current.values(),
      ]);
      if (!inputs.length) {
        throw new Error(t("classroom.recording_empty"));
      }
      capturingRef.current = true;
      const mix = startClassroomRecordingMix(inputs);
      mixStopRef.current = mix.stop;
      recordingIdRef.current = recordingId;
      try {
        recorderRef.current = createClassroomMediaRecorder(mix.stream, (blob) => {
          uploadQueue.current = uploadQueue.current
            .then(() => uploadRecordingChunk(recordingId, blob))
            .catch((err) => {
              setError(err instanceof Error ? err.message : t("classroom.record_failed"));
            });
        });
      } catch (err) {
        mix.stop();
        mixStopRef.current = null;
        recordingIdRef.current = null;
        capturingRef.current = false;
        throw err instanceof Error ? err : new Error(t("classroom.record_failed"));
      }
    },
    [t, uploadRecordingChunk],
  );

  useEffect(() => {
    const recordingId = session.recording?.id;
    if (!session.self.canRecord || !recordingId || stoppingRef.current) return;
    if (recorderRef.current || capturingRef.current) return;
    void beginCapture(recordingId).catch(async (err) => {
      setError(err instanceof Error ? err.message : t("classroom.recording_empty"));
      try {
        await postJson(`/api/v1/classrooms/${session.classroom.id}/recording`, {
          action: "stop",
        });
      } catch {
        // already stopped or left
      }
      setSession((current) => ({ ...current, recording: null }));
    });
  }, [beginCapture, session.classroom.id, session.recording?.id, session.self.canRecord, t]);

  async function toggleRecording() {
    setError("");
    try {
      if (session.recording) {
        setSavingRecording(true);
        stoppingRef.current = true;
        await stopCapture();
        const recording = await postJson<ClassroomSessionView["recording"]>(
          `/api/v1/classrooms/${session.classroom.id}/recording`,
          { action: "stop" },
        );
        setSession((current) => ({ ...current, recording: null }));
        setNotice(
          t("classroom.recording_saved", {
            time: formatClassroomRecordingTime(recording?.durationSeconds ?? 0),
          }),
        );
        return;
      }
      const recording = await postJson<ClassroomSessionView["recording"]>(
        `/api/v1/classrooms/${session.classroom.id}/recording`,
        { action: "start" },
      );
      setSession((current) => ({ ...current, recording }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("classroom.record_failed"));
    } finally {
      stoppingRef.current = false;
      setSavingRecording(false);
    }
  }

  async function shareFile(file: File) {
    setError("");
    setUploadingFile(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(
        `/api/v1/classrooms/${session.classroom.id}/files`,
        { method: "POST", credentials: "include", body },
      );
      const json = (await response.json()) as
        | { ok: true; data: ClassroomSessionView["files"][number] }
        | { ok: false; error?: { code?: string; message?: string } };
      if (!response.ok || !json.ok) {
        throw new ApiClientError(
          !json.ok ? json.error?.message || t("classroom.files_failed") : t("classroom.files_failed"),
          !json.ok ? json.error?.code : undefined,
        );
      }
      setSession((current) => ({
        ...current,
        files: mergeClassroomFiles(current.files, [json.data]),
      }));
    } catch (err) {
      setError(
        err instanceof ApiClientError && err.code === "CONTACT_BLOCKED"
          ? t("classroom.files_contact")
          : err instanceof Error
            ? err.message
            : t("classroom.files_failed"),
      );
    } finally {
      setUploadingFile(false);
    }
  }

  async function removeFile(fileId: string) {
    setError("");
    try {
      await deleteJson(`/api/v1/classrooms/${session.classroom.id}/files/${fileId}`);
      setSession((current) => ({
        ...current,
        files: current.files.filter((item) => item.id !== fileId),
        presentation:
          current.presentation?.fileId === fileId ? null : current.presentation,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("classroom.files_failed"));
    }
  }

  async function leave() {
    if (session.self.canRecord && (session.recording || recordingIdRef.current)) {
      stoppingRef.current = true;
      await stopCapture();
      try {
        await postJson(`/api/v1/classrooms/${session.classroom.id}/recording`, {
          action: "stop",
        });
      } catch {
        // still leave the page
      }
    }
    try {
      await postJson(`/api/v1/classrooms/${session.classroom.id}/leave`, {});
    } catch {
      // still leave the page
    }
    window.location.assign(leaveHref);
  }

  return (
    <div
      className="flex min-h-full flex-1 flex-col bg-background"
      style={
        {
          "--classroom-primary": overlay.primaryColor,
          "--classroom-accent": overlay.accentColor,
        } as CSSProperties
      }
    >
      <header className="border-b border-line bg-surface px-4 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <ClassroomOverlay brand={brand} overlay={overlay} placement="bar" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ClassroomLessonTimer
              startsAt={session.classroom.startsAt}
              endsAt={session.classroom.endsAt}
            />
            {session.recording ? (
              <span className="rounded-full bg-rose px-3 py-1 text-xs font-extrabold uppercase text-brand">
                {t("classroom.recording")}
                {" · "}
                {t("classroom.recording_secure")}
                {" · "}
                <ClassroomRecordingClock startedAt={session.recording.startedAt} />
              </span>
            ) : null}
            {session.self.canPublish ? (
              <ClassroomSpeechCaptions
                classroomId={session.classroom.id}
                recordingId={session.recording?.id}
                role={session.self.role}
                displayName={session.self.displayName}
                userId={session.self.userId}
              />
            ) : null}
            {session.self.canRecord ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={savingRecording}
                onClick={() => void toggleRecording()}
              >
                {savingRecording
                  ? t("classroom.recording_saving")
                  : session.recording
                    ? t("classroom.stop_recording")
                    : t("classroom.start_recording")}
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="ghost" onClick={() => void leave()}>
              {t("classroom.leave")}
            </Button>
          </div>
        </div>
        <p className="mx-auto mt-2 max-w-7xl text-sm font-semibold text-brand">
          {session.classroom.title}
          {" · "}
          {t(`classroom.role_${session.self.role}` as UiMessageKey)}
          {" · "}
          {waitingCount
            ? t("classroom.people_of", {
                present: presentCount,
                total: people.length,
              })
            : t("classroom.people_count", { count: presentCount })}
          {session.classroom.kind === "group"
            ? ` · ${t("classroom.capacity", { count: session.classroom.studentCapacity })}`
            : ""}
        </p>
        {overlay.caption ? (
          <p className="mx-auto mt-1 max-w-7xl text-xs font-semibold text-muted">
            {overlay.caption}
          </p>
        ) : null}
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(16rem,0.8fr)]">
        <section className="rounded-[1.5rem] border border-line bg-surface p-4">
          <h2 className="text-sm font-extrabold uppercase text-brand-soft">
            {t("classroom.video")}
          </h2>
          <p className="mt-1 text-xs font-semibold text-muted">
            {session.classroom.kind === "group"
              ? t("classroom.people_help")
              : t("classroom.video_help")}
          </p>
          {sharer ? (
            <div className="mt-3">
              <p className="text-xs font-extrabold uppercase text-brand-soft">
                {t("classroom.sharing_by", { name: sharer.displayName })}
              </p>
              <ClassroomMediaTile
                brand={brand}
                overlay={overlay}
                name={sharer.displayName}
                you={sharer.userId === selfId}
                roleLabel={t(`classroom.role_${sharer.role}` as UiMessageKey)}
                cameraOn={false}
                micOn={false}
                screen
                muted
                className="mt-2"
                actions={
                  sharer.userId === selfId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void stopShare()}
                    >
                      {t("classroom.stop_share")}
                    </Button>
                  ) : canControlMedia && sharer.role !== "teacher" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void controlRemote(sharer.userId, "screen_off")}
                    >
                      {t("classroom.stop_their_share")}
                    </Button>
                  ) : null
                }
                videoRef={
                  sharer.userId === selfId
                    ? bindLocalScreen
                    : (node) => bindRemoteScreen(sharer.userId, node)
                }
              />
            </div>
          ) : null}
          <div className={`mt-3 grid gap-3 ${classroomTileGridClass(people.length)}`}>
            {people.map((person) => {
              const isSelf = person.userId === selfId;
              const incoming = remoteFlags[person.userId];
              const state = peerState[person.userId];
              const featured =
                people.length >= 3 && person.userId === teacherId;
              const roleKey = `classroom.role_${person.role}` as UiMessageKey;
              const remoteCamera = incoming?.cameraOn ?? person.cameraOn;
              const remoteMic = incoming?.micOn ?? person.micOn;
              const showTeacherControls =
                canControlMedia &&
                person.present &&
                !isSelf &&
                person.role !== "teacher";
              return (
                <ClassroomMediaTile
                  key={person.userId}
                  brand={brand}
                  overlay={overlay}
                  name={person.displayName}
                  you={isSelf}
                  roleLabel={t(roleKey)}
                  cameraOn={isSelf ? localFlags.cameraOn : remoteCamera}
                  micOn={isSelf ? localFlags.micOn : remoteMic}
                  speaking={Boolean(speaking[person.userId])}
                  connecting={
                    !isSelf &&
                    person.present &&
                    (state === "new" || state === "connecting")
                  }
                  waiting={!isSelf && !person.present}
                  muted={isSelf}
                  className={featured ? "sm:col-span-2" : ""}
                  actions={
                    showTeacherControls ? (
                      <>
                        {remoteMic ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => void controlRemote(person.userId, "mute")}
                          >
                            {t("classroom.mute_student")}
                          </Button>
                        ) : null}
                        {remoteCamera ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              void controlRemote(person.userId, "camera_off")
                            }
                          >
                            {t("classroom.camera_stop_student")}
                          </Button>
                        ) : null}
                        {person.screenSharing || remoteScreens[person.userId] ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              void controlRemote(person.userId, "screen_off")
                            }
                          >
                            {t("classroom.stop_their_share")}
                          </Button>
                        ) : null}
                      </>
                    ) : null
                  }
                  videoRef={
                    isSelf
                      ? bindLocalVideo
                      : person.present
                        ? (node) => bindRemoteVideo(person.userId, node)
                        : undefined
                  }
                />
              );
            })}
          </div>
          {!mediaReady ? (
            <Button
              className="mt-4 w-full"
              disabled={startingMedia}
              onClick={() => void enableMedia()}
            >
              {session.self.canPublish
                ? t("classroom.enable_media")
                : t("classroom.listen")}
            </Button>
          ) : session.self.canPublish ? (
            <ClassroomMediaControls
              cameraOn={localFlags.cameraOn}
              micOn={localFlags.micOn}
              cameras={cameras}
              mics={mics}
              cameraId={cameraId}
              micId={micId}
              sharing={localSharing}
              canShare={session.self.canPublish}
              canMuteAll={
                canControlMedia &&
                people.some(
                  (item) =>
                    item.present &&
                    item.userId !== selfId &&
                    item.role !== "teacher" &&
                    (remoteFlags[item.userId]?.micOn ?? item.micOn),
                )
              }
              onToggleCamera={() => void setCameraEnabled(!localFlags.cameraOn)}
              onToggleMic={() => void setMicEnabled(!localFlags.micOn)}
              onCameraChange={(deviceId) => void switchDevice("video", deviceId)}
              onMicChange={(deviceId) => void switchDevice("audio", deviceId)}
              onToggleShare={() => void (localSharing ? stopShare() : startShare())}
              onMuteAll={() => void muteAll()}
            />
          ) : null}
          {notice ? (
            <p className="mt-3 text-xs font-semibold text-brand">{notice}</p>
          ) : null}
          <ClassroomRecordingNotice live={Boolean(session.recording)} saving={savingRecording} />
          {session.self.canRecord ? (
            <p className="mt-3 text-xs font-semibold text-muted">{t("classroom.recording_help")}</p>
          ) : null}
          {session.self.canPublish ? (
            <p className="mt-3 text-xs font-semibold text-muted">{t("classroom.speech_help")}</p>
          ) : null}
          <p className="mt-3 text-xs font-semibold text-muted">{t("classroom.no_phone")}</p>
        </section>

        {session.presentation?.open ? (
          <ClassroomPresentationStage
            deck={session.presentation}
            board={session.whiteboard}
            files={session.files}
            classroomId={session.classroom.id}
            selfId={selfId}
            selfName={session.self.displayName}
            people={people}
            canPresent={canControlMedia}
            canDraw={session.self.canDraw}
            canClear={session.self.canClearBoard}
            locked={session.self.role === "student" && !session.self.canDraw}
            remotePointers={pointers}
            onChange={updatePresentation}
            onUpdate={updateBoard}
            onUploadImage={uploadBoardImage}
          />
        ) : null}

        <ClassroomWhiteboard
          board={session.whiteboard}
          files={session.files}
          classroomId={session.classroom.id}
          selfId={selfId}
          selfName={session.self.displayName}
          people={people}
          canDraw={session.self.canDraw}
          canClear={session.self.canClearBoard}
          locked={session.self.role === "student" && !session.self.canDraw}
          stayWithClass={stayWithClass}
          remotePointers={pointers}
          onBrowse={() => setStayWithClass(false)}
          onUpdate={updateBoard}
          onUploadImage={uploadBoardImage}
        />

        <section className="flex flex-col rounded-[1.5rem] border border-line bg-surface p-4">
          <ClassroomChat
            messages={session.messages}
            selfId={selfId}
            draft={draft}
            sending={sendingChat}
            onDraftChange={setDraft}
            onSend={() => void sendMessage()}
          />
          {session.self.role === "student" ? (
            <ClassroomNotes classroomId={session.classroom.id} />
          ) : null}
          <ClassroomFiles
            files={session.files}
            selfId={selfId}
            canShare={session.self.canShareFiles}
            canRemoveAny={canControlMedia}
            canAnnotate={session.self.canDraw}
            canPresent={canControlMedia}
            presentingFileId={
              session.presentation?.open ? session.presentation.fileId : undefined
            }
            uploading={uploadingFile}
            onUpload={(file) => void shareFile(file)}
            onRemove={(fileId) => void removeFile(fileId)}
            onAnnotate={(fileId) => void updateBoard({ annotateFileId: fileId })}
            onPresent={(fileId) => void updatePresentation({ action: "open", fileId })}
          />
          <div className="mt-4">
            <ClassroomRecordingLibrary
              recordings={session.recordings ?? []}
              retentionDays={session.retentionDays ?? 365}
              onChange={(recordings) =>
                setSession((current) => ({ ...current, recordings }))
              }
            />
          </div>
          <div className="mt-4">
            <h3 className="text-xs font-extrabold uppercase text-muted">
              {t("classroom.people")}
            </h3>
            <ul className="mt-2 space-y-2 text-sm font-semibold text-brand">
              {people.map((person) => {
                const flags =
                  person.userId === selfId
                    ? localFlags
                    : (remoteFlags[person.userId] ?? {
                        cameraOn: person.cameraOn,
                        micOn: person.micOn,
                      });
                const roleKey = `classroom.role_${person.role}` as UiMessageKey;
                return (
                  <li key={person.userId}>
                    <p>
                      {person.displayName}
                      {person.userId === selfId ? ` · ${t("classroom.you")}` : ""}
                    </p>
                    <p className="text-xs font-semibold text-muted">
                      {t(roleKey)}
                      {" · "}
                      {person.present
                        ? t("classroom.present")
                        : t("classroom.waiting")}
                      {person.present
                        ? ` · ${flags.cameraOn ? t("classroom.camera_on") : t("classroom.camera_off")} · ${flags.micOn ? t("classroom.mic_on") : t("classroom.mic_off")}`
                        : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </div>
      {error ? (
        <p className="mx-auto mb-4 max-w-7xl rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
    </div>
  );
}
