import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  api,
  clearToken,
  clientPlatform,
  loadToken,
  saveToken,
} from "./src/api";
import { ANDROID_PACKAGE, IOS_BUNDLE_ID } from "./src/config";
import { copy, facultyOrder, facultyTitle, type FacultyId } from "./src/copy";

type Home = {
  account: { userId: string; roleKey: string; learnerIds: string[] };
  booking: { lessons: number; rows: Row[] };
  payments: { lessons: number; payouts: number | null; rows: Row[] };
  classroom: { rooms: number; rows: ClassroomRow[] };
  messaging: { conversations: number };
  homework: { pieces: number };
  reports: { records: number };
  progress: { rowsCount: number };
  notifications: { total: number; unread: number };
  recordings: { total: number };
  materials: { published: number };
  search: { approved: number };
  push: { connected: boolean; sent: number; devices: number };
  ios: { registered: boolean; bundleId: string };
  android: { registered: boolean; packageName: string };
};

type Row = { id: string; title: string; meta: string };
type ClassroomRow = Row & { bookingId?: string | null };

type Thread = {
  id: string;
  channel: string;
  otherUserId: string;
  otherName: string;
  preview: string;
};

type Teacher = {
  userId: string;
  displayName: string;
  headline?: string | null;
  subjects?: { slug: string; name: string }[];
  rate?: { formatted?: string } | null;
};

const brand = "#294634";
const gold = "#CB9F64";
const paper = "#F3F4F2";
const ink = "#333333";
const muted = "#5E6B63";

export default function App() {
  const text = copy();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState(true);
  const [home, setHome] = useState<Home | null>(null);
  const [faculty, setFaculty] = useState<FacultyId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadToken()
      .then((saved) => {
        setToken(saved);
        if (saved) return refresh(saved);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setReady(true));
  }, []);

  async function refresh(next = token) {
    if (!next) return;
    const data = (await api("/api/v1/mobile/home", next)) as Home;
    setHome(data);
  }

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const data = (await api("/api/v1/auth/login", null, {
        method: "POST",
        auth: null,
        body: { email: email.trim(), password },
      })) as {
        sessionToken?: string;
        twoFactor?: { required?: boolean; enrolled?: boolean; challengeToken?: string };
      };
      if (data.twoFactor?.required) {
        setEnrolled(Boolean(data.twoFactor.enrolled));
        setChallenge(data.twoFactor.challengeToken ?? null);
        return;
      }
      if (!data.sessionToken) {
        throw new Error(text.webOnly);
      }
      await saveToken(data.sessionToken);
      setToken(data.sessionToken);
      setPassword("");
      await refresh(data.sessionToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : text.empty);
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode() {
    if (!challenge) return;
    setBusy(true);
    setError(null);
    try {
      const data = (await api("/api/v1/auth/two-factor", null, {
        method: "POST",
        auth: challenge,
        body: { code: code.trim() },
      })) as { sessionToken?: string };
      if (!data.sessionToken) throw new Error(text.webOnly);
      await saveToken(data.sessionToken);
      setToken(data.sessionToken);
      setChallenge(null);
      setCode("");
      await refresh(data.sessionToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : text.empty);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    try {
      if (token) {
        await api("/api/v1/auth/logout", token, { method: "POST", body: {} });
      }
    } catch {
      // The local session is cleared either way.
    }
    await clearToken();
    setToken(null);
    setHome(null);
    setFaculty(null);
  }

  if (!ready) {
    return (
      <SafeAreaView style={styles.screen}>
        <ActivityIndicator color={gold} />
      </SafeAreaView>
    );
  }

  if (Platform.OS === "web") {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.brand}>{text.brand}</Text>
        <Text style={styles.body}>{text.webOnly}</Text>
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <Text style={styles.brand}>{text.brand}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.pad}>
          <Text style={styles.title}>{challenge ? text.code : text.signIn}</Text>
          {challenge ? (
            enrolled ? (
              <Field label={text.code} value={code} onChange={setCode} />
            ) : (
              <Text style={styles.body}>{text.webOnly}</Text>
            )
          ) : (
            <>
              <Field label={text.email} value={email} onChange={setEmail} />
              <Field label={text.password} value={password} onChange={setPassword} secure />
            </>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <GoldButton
            label={busy ? text.loading : challenge ? text.confirm : text.signIn}
            onPress={challenge ? confirmCode : signIn}
            disabled={busy || (Boolean(challenge) && !enrolled)}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (faculty && home) {
    return (
      <FacultyScreen
        id={faculty}
        home={home}
        token={token}
        onBack={() => setFaculty(null)}
        onChanged={() => refresh().catch((err: Error) => setError(err.message))}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.brand}>{text.brand}</Text>
        <Pressable onPress={signOut}>
          <Text style={styles.headerLink}>{text.signOut}</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={facultyOrder}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.pad}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => setFaculty(item)}>
            <Text style={styles.cardTitle}>{facultyTitle(item)}</Text>
            <Text style={styles.meta}>{summary(item, home)}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

function summary(id: FacultyId, home: Home | null) {
  if (!home) return "";
  if (id === "ios") return home.ios.bundleId;
  if (id === "android") return home.android.packageName;
  if (id === "login") return home.account.roleKey;
  if (id === "search") return String(home.search.approved);
  if (id === "booking") return String(home.booking.lessons);
  if (id === "payments") return String(home.payments.lessons);
  if (id === "classroom") return String(home.classroom.rooms);
  if (id === "messaging") return String(home.messaging.conversations);
  if (id === "homework") return String(home.homework.pieces);
  if (id === "reports") return String(home.reports.records);
  if (id === "progress") return String(home.progress.rowsCount);
  if (id === "notifications") return String(home.notifications.unread);
  if (id === "recordings") return String(home.recordings.total);
  if (id === "materials") return String(home.materials.published);
  return home.push.connected ? "On" : "Off";
}

function FacultyScreen({
  id,
  home,
  token,
  onBack,
  onChanged,
}: {
  id: FacultyId;
  home: Home;
  token: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const text = copy();
  const [detail, setDetail] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Teacher | null>(null);
  const [studentId, setStudentId] = useState(
    home.account.roleKey === "student" ? home.account.userId : home.account.learnerIds[0] ?? "",
  );
  const [startsAt, setStartsAt] = useState("");
  const [reply, setReply] = useState("");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<Thread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const path =
      id === "booking"
        ? "/api/v1/bookings"
        : id === "messaging"
          ? "/api/v1/messages"
          : id === "homework"
            ? "/api/v1/homework"
            : id === "reports"
              ? "/api/v1/reports"
              : id === "progress"
                ? "/api/v1/progress"
                : id === "notifications"
                  ? "/api/v1/account/notifications"
                  : id === "recordings"
                    ? "/api/v1/recordings"
                    : id === "materials"
                      ? "/api/v1/library"
                      : null;
    if (!path) return;
    api(path, token)
      .then((data) => {
        if (id === "messaging") {
          const inbox = data as { threads?: Thread[] };
          setThreads(inbox.threads ?? []);
        } else {
          setDetail(present(data));
        }
      })
      .catch((err: Error) => setError(err.message));
  }, [id, token]);

  async function findTeachers() {
    setBusy(true);
    setError(null);
    try {
      const data = (await api(
        `/api/v1/teachers?q=${encodeURIComponent(query.trim())}`,
        token,
      )) as { teachers?: Teacher[] };
      setTeachers(data.teachers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : text.empty);
    } finally {
      setBusy(false);
    }
  }

  async function bookLesson() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/bookings", token, {
        method: "POST",
        body: {
          teacherUserId: picked.userId,
          studentUserId: studentId,
          subjectSlug: picked.subjects?.[0]?.slug,
          startsAt,
          kind: "lesson",
        },
      });
      setStartsAt("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : text.empty);
    } finally {
      setBusy(false);
    }
  }

  async function registerDevice() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/mobile/devices", token, {
        method: "POST",
        body: { platform: clientPlatform(), appVersion: "1.0.0" },
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : text.empty);
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom(bookingId: string) {
    setBusy(true);
    setError(null);
    try {
      const room = await api("/api/v1/classrooms/join", token, {
        method: "POST",
        body: { bookingId },
      });
      setDetail(present(room));
    } catch (err) {
      setError(err instanceof Error ? err.message : text.empty);
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!active || !reply.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/messages", token, {
        method: "POST",
        body: {
          channel: active.channel,
          recipientUserId: active.otherUserId,
          body: reply.trim(),
        },
      });
      setReply("");
      const inbox = (await api("/api/v1/messages", token)) as { threads?: Thread[] };
      setThreads(inbox.threads ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : text.empty);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.headerLink}>{text.back}</Text>
        </Pressable>
        <Text style={styles.brand}>{facultyTitle(id)}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.pad}>
        {id === "ios" || id === "android" ? (
          <>
            <Text style={styles.body}>
              {id === "ios" ? IOS_BUNDLE_ID : ANDROID_PACKAGE}
            </Text>
            <Text style={styles.meta}>{text.store}</Text>
            {clientPlatform() === id ? (
              <GoldButton label={text.register} onPress={registerDevice} disabled={busy} />
            ) : null}
          </>
        ) : null}
        {id === "push" ? (
          <>
            <Text style={styles.body}>{text.pushOff}</Text>
            <Text style={styles.meta}>{String(home.push.sent)}</Text>
            <GoldButton label={text.register} onPress={registerDevice} disabled={busy} />
          </>
        ) : null}
        {id === "search" || id === "booking" ? (
          <>
            <Field label={text.search} value={query} onChange={setQuery} />
            <GoldButton label={busy ? text.loading : text.search} onPress={findTeachers} disabled={busy} />
            {teachers.map((teacher) => (
              <Pressable key={teacher.userId} style={styles.card} onPress={() => setPicked(teacher)}>
                <Text style={styles.cardTitle}>{teacher.displayName}</Text>
                <Text style={styles.meta}>
                  {(teacher.subjects ?? []).map((item) => item.name).join(", ")}
                  {teacher.rate?.formatted ? ` · ${teacher.rate.formatted}` : ""}
                </Text>
              </Pressable>
            ))}
          </>
        ) : null}
        {id === "booking" && picked ? (
          <>
            <Text style={styles.cardTitle}>{picked.displayName}</Text>
            {home.account.roleKey !== "student" ? (
              <Field label={text.student} value={studentId} onChange={setStudentId} />
            ) : null}
            <Field label={text.starts} value={startsAt} onChange={setStartsAt} />
            <GoldButton label={text.book} onPress={bookLesson} disabled={busy} />
          </>
        ) : null}
        {id === "payments" ? (
          <>
            <Text style={styles.body}>{String(home.payments.lessons)}</Text>
            {home.payments.payouts === null
              ? null
              : <Text style={styles.meta}>{String(home.payments.payouts)}</Text>}
            {home.payments.rows.map((row) => (
              <View key={row.id} style={styles.card}>
                <Text style={styles.cardTitle}>{row.title}</Text>
                <Text style={styles.meta}>{row.meta}</Text>
              </View>
            ))}
          </>
        ) : null}
        {id === "classroom"
          ? home.classroom.rows.map((row) => (
              <View key={row.id} style={styles.card}>
                <Text style={styles.cardTitle}>{row.title}</Text>
                <Text style={styles.meta}>{row.meta}</Text>
                {row.bookingId ? (
                  <GoldButton
                    label={text.join}
                    onPress={() => joinRoom(row.bookingId!)}
                    disabled={busy}
                  />
                ) : null}
              </View>
            ))
          : null}
        {id === "messaging"
          ? threads.map((thread) => (
              <Pressable key={thread.id} style={styles.card} onPress={() => setActive(thread)}>
                <Text style={styles.cardTitle}>{thread.otherName}</Text>
                <Text style={styles.meta}>{thread.preview}</Text>
              </Pressable>
            ))
          : null}
        {active ? (
          <>
            <Field label={text.reply} value={reply} onChange={setReply} />
            <GoldButton label={text.send} onPress={sendReply} disabled={busy} />
          </>
        ) : null}
        {detail ? <Text style={styles.body}>{detail}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function present(value: unknown) {
  const hidden = /earn|commission|payout|token|password|secret|email|ipaddress|useragent/i;
  const lines: string[] = [];
  const walk = (node: unknown, depth: number) => {
    if (lines.length > 40 || depth > 4 || node == null) return;
    if (Array.isArray(node)) {
      node.slice(0, 8).forEach((item) => walk(item, depth + 1));
      return;
    }
    if (typeof node === "object") {
      for (const [key, item] of Object.entries(node as Record<string, unknown>)) {
        if (hidden.test(key)) continue;
        if (typeof item === "string" || typeof item === "number") {
          lines.push(`${key}: ${item}`);
        } else {
          walk(item, depth + 1);
        }
      }
    }
  };
  walk(value, 0);
  return lines.join("\n") || copy().empty;
}

function Field({
  label,
  value,
  onChange,
  secure = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  secure?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        autoCapitalize="none"
        style={styles.input}
        placeholderTextColor={muted}
      />
    </View>
  );
}

function GoldButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, disabled ? styles.disabled : null]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: paper },
  header: {
    backgroundColor: brand,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: { color: gold, fontSize: 20, fontWeight: "700" },
  headerLink: { color: gold, fontWeight: "700" },
  pad: { padding: 16, gap: 12 },
  title: { color: brand, fontSize: 28, fontWeight: "700" },
  body: { color: ink, fontSize: 16, lineHeight: 24 },
  meta: { color: muted, marginTop: 4 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { color: brand, fontSize: 18, fontWeight: "700" },
  field: { marginBottom: 12 },
  label: { color: muted, marginBottom: 6, fontWeight: "700" },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: ink,
  },
  button: {
    backgroundColor: gold,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  buttonText: { color: brand, fontWeight: "700" },
  disabled: { opacity: 0.6 },
  error: { color: "#8C3A32", margin: 16 },
});
