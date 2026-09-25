"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  aiSpeechRecognitionSupported,
  speechSegmentFromText,
  startAiSpeechRecognition,
} from "@/lib/ai-speech";
import {
  looksArabic,
  type AiLocale,
  type AiSpeakerRole,
  type AiTranscriptSegment,
} from "@/lib/ai-systems";

function subscribeSpeechSupport() {
  return () => undefined;
}

export function useLessonSpeechCapture(input: {
  locale: AiLocale;
  speakerRole: AiSpeakerRole;
  speakerName: string;
  speakerUserId?: string;
}) {
  const [listening, setListening] = useState(false);
  const supported = useSyncExternalStore(
    subscribeSpeechSupport,
    aiSpeechRecognitionSupported,
    () => false,
  );
  const [interim, setInterim] = useState("");
  const [segments, setSegments] = useState<AiTranscriptSegment[]>([]);
  const [error, setError] = useState("");
  const [heardArabic, setHeardArabic] = useState(false);
  const sessionRef = useRef<ReturnType<typeof startAiSpeechRecognition>>(null);
  const startedAt = useRef(0);
  const inputRef = useRef(input);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    return () => sessionRef.current?.stop();
  }, []);

  function start() {
    sessionRef.current?.stop();
    startedAt.current = Date.now();
    setError("");
    setInterim("");
    setHeardArabic(false);
    const session = startAiSpeechRecognition({
      locale: inputRef.current.locale,
      onFinal(text, confidence) {
        const segment = speechSegmentFromText({
          body: text,
          speakerRole: inputRef.current.speakerRole,
          speakerName: inputRef.current.speakerName,
          speakerUserId: inputRef.current.speakerUserId,
          startedAt: startedAt.current,
          confidence,
          locale: inputRef.current.locale,
        });
        if (segment) {
          if (looksArabic(segment.body)) setHeardArabic(true);
          setSegments((current) => [...current, segment].slice(-400));
        }
        setInterim("");
      },
      onInterim(text) {
        setInterim(text);
      },
      onError(code) {
        setError(code);
        setListening(false);
      },
    });
    if (!session) {
      setError("unsupported");
      setListening(false);
      return;
    }
    sessionRef.current = session;
    setListening(true);
  }

  function stop() {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setListening(false);
    setInterim("");
  }

  function clear() {
    setSegments([]);
    setInterim("");
    setError("");
    setHeardArabic(false);
  }

  function replace(next: AiTranscriptSegment[]) {
    setSegments(next);
  }

  const arabicFallback =
    input.locale === "ar" && segments.length > 0 && !heardArabic;

  return {
    listening,
    supported,
    interim,
    segments,
    error,
    arabicFallback,
    start,
    stop,
    clear,
    replace,
  };
}
