import {
  normaliseArabicTranscript,
  normaliseEnglishTranscript,
  speechRecognitionLangs,
  type AiLocale,
  type AiSpeakerRole,
  type AiTranscriptSegment,
} from "@/lib/ai-systems";

type SpeechAlternative = {
  transcript: string;
  confidence: number;
};

type SpeechResultLike = {
  isFinal: boolean;
  length: number;
  0?: SpeechAlternative;
};

type SpeechEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechResultLike>;
};

type SpeechErrorLike = {
  error?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechEventLike) => void) | null;
  onerror: ((event: SpeechErrorLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export function aiSpeechRecognitionSupported() {
  if (typeof window === "undefined") return false;
  const view = window as SpeechWindow;
  return Boolean(view.SpeechRecognition || view.webkitSpeechRecognition);
}

function recognitionCtor() {
  if (typeof window === "undefined") return null;
  const view = window as SpeechWindow;
  return view.SpeechRecognition ?? view.webkitSpeechRecognition ?? null;
}

export function startAiSpeechRecognition(options: {
  locale: AiLocale;
  onFinal: (text: string, confidence: number) => void;
  onInterim: (text: string) => void;
  onError: (code: string) => void;
}) {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    options.onError("unsupported");
    return null;
  }
  const recognition = new Ctor();
  const langs = speechRecognitionLangs(options.locale);
  let langIndex = 0;
  recognition.lang = langs[0] ?? "en-GB";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  let wanted = true;
  let switchingLang = false;

  recognition.onresult = (event) => {
    let interim = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const text = result?.[0]?.transcript?.trim() ?? "";
      if (!text) continue;
      if (result.isFinal) {
        options.onFinal(text, result[0]?.confidence ?? 0);
      } else {
        interim = interim ? `${interim} ${text}` : text;
      }
    }
    options.onInterim(interim);
  };
  recognition.onerror = (event) => {
    const code = event.error || "failed";
    if (code === "aborted" || code === "no-speech") return;
    if (code === "language-not-supported" && langIndex < langs.length - 1) {
      langIndex += 1;
      recognition.lang = langs[langIndex] ?? langs[0] ?? "en-GB";
      switchingLang = true;
      try {
        recognition.start();
        switchingLang = false;
      } catch {
        switchingLang = false;
        options.onError("language-not-supported");
      }
      return;
    }
    options.onError(code);
  };
  recognition.onend = () => {
    if (!wanted || switchingLang) return;
    try {
      recognition.start();
    } catch {
      options.onError("failed");
    }
  };

  try {
    recognition.start();
  } catch {
    options.onError("failed");
    return null;
  }

  return {
    stop() {
      wanted = false;
      recognition.onend = null;
      try {
        recognition.stop();
      } catch {
        try {
          recognition.abort();
        } catch {
          // already stopped
        }
      }
    },
  };
}

export function speechSegmentFromText(input: {
  body: string;
  speakerRole: AiSpeakerRole;
  speakerName: string;
  speakerUserId?: string;
  startedAt: number;
  confidence?: number;
  locale?: AiLocale;
}): AiTranscriptSegment | null {
  const raw = input.body.trim();
  if (!raw) return null;
  const body =
    input.locale === "en"
      ? normaliseEnglishTranscript(raw)
      : input.locale === "ar"
        ? normaliseArabicTranscript(raw)
        : raw;
  return {
    speakerRole: input.speakerRole,
    speakerName: input.speakerName,
    speakerUserId: input.speakerUserId,
    at: new Date().toISOString(),
    startMs: Math.max(0, Date.now() - input.startedAt),
    confidence: input.confidence,
    source: "speech",
    body,
  };
}
