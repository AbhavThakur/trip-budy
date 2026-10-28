import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Icon, Row, Txt } from '@/components/ui';
import { success } from '@/lib/haptics';
import { normalizeImportedTrip } from '@/lib/new-trip';
import { useTrips } from '@/store/trips';
import { setMyTraveler } from '@/sync/engine';
import { colors, radius, space } from '@/theme';

const AI_PROMPT = `You are a trip planner. Read the tickets, bookings and itinerary I paste below and reply with ONE JSON object only (no prose, no code fences) for the Trip Buddy app. Use only facts in my text; omit or leave empty what is unknown.
{
 "id": "destination-year", "title": "", "subtitle": "", "destination": "", "country": "", "flag": "🇹🇭",
 "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD",
 "timezone": "IANA zone of the destination, e.g. Asia/Bangkok", "homeTimezone": "Asia/Kolkata", "speechLocale": "th-TH",
 "currency": { "code": "THB", "symbol": "฿", "decimals": 2, "inrPerUnit": 2.5 },
 "travelers": [ { "id": "abhav", "name": "Full name", "shortName": "Abhav", "color": "#F59E0B" } ],
 "flights": [ { "id": "f1", "airline": "", "flightNo": "", "from": { "code": "BLR", "city": "Bengaluru" }, "to": { "code": "BKK", "city": "Bangkok" },
   "depart": "2027-01-03T09:00:00+05:30", "arrive": "2027-01-03T14:30:00+07:00", "cabinKg": 7, "checkinKg": 20, "status": "confirmed",
   "bookings": [ { "pnr": "", "travelerIds": ["abhav"] } ] } ],
 "stays": [ { "id": "s1", "kind": "hotel", "name": "", "city": "", "address": "", "lat": 0, "lng": 0,
   "checkIn": "2027-01-03T14:00:00+07:00", "checkOut": "2027-01-06T11:00:00+07:00", "rooms": [], "status": "confirmed" } ],
 "days": [ { "index": 1, "date": "2027-01-03", "title": "Arrive Bangkok", "stops": [
   { "id": "d1-1", "start": "2027-01-03T17:00:00+07:00", "title": "Dinner at …", "category": "food|sight|shopping|transit|activity", "lat": 0, "lng": 0, "address": "", "notes": "" } ] } ],
 "emergency": [ { "id": "e1", "kind": "police|ambulance|fire|embassy|hospital|insurance|other", "label": "Police", "phone": "191", "status": "verify" } ],
 "checklist": [ { "id": "before", "title": "Before you go", "items": [ { "id": "b1", "text": "Passports valid", "perTraveler": true } ] } ]
}
Rules: one entry in "days" for every date from startDate to endDate; all ids unique; times are ISO with the local UTC offset; flights and hotel check-ins appear on the timeline automatically, so do not repeat them as stops.

MY TICKETS AND PLANS:
`;

export default function ImportTrip() {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const trips = useTrips((s) => s.trips);
  const setTrip = useTrips((s) => s.setTrip);

  const paste = async () => setText(await Clipboard.getStringAsync());

  const doImport = () => {
    let raw: unknown;
    try {
      raw = JSON.parse(text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, ''));
    } catch {
      return setError('That is not valid JSON. Paste the whole reply from the AI, starting with { and ending with }.');
    }
    const { trip, error: err } = normalizeImportedTrip(raw);
    if (err || !trip) return setError(err ?? 'Could not read that trip.');
    let id = trip.id;
    for (let n = 2; trips[id]; n++) id = `${trip.id}-${n}`;
    const t = { ...trip, id };
    setTrip(t, { source: 'local', version: 0, dirty: false });
    void setMyTraveler(t.id, t.travelers[0].id);
    success();
    router.dismissAll();
    router.replace(`/trip/${t.id}`);
  };

  return (
    <Screen title="Import trip" subtitle="Tickets → AI → full trip" footer={<Button label="Import trip" icon="download" onPress={doImport} disabled={!text.trim()} />}>
      <Card>
        <Txt v="h3">1 · Ask any AI</Txt>
        <Txt v="small" color={colors.textDim} style={{ marginTop: 4 }}>
          Copy the prompt, paste it into ChatGPT / Gemini / Claude, then add your ticket text or the PDFs below it.
        </Txt>
        <View style={{ marginTop: space.md }}>
          <Button
            label={copied ? 'Copied' : 'Copy AI prompt'}
            icon={copied ? 'checkmark' : 'copy'}
            kind="ghost"
            onPress={async () => {
              await Clipboard.setStringAsync(AI_PROMPT);
              setCopied(true);
            }}
          />
        </View>
      </Card>
      <Card style={{ marginTop: space.md }}>
        <Row>
          <Txt v="h3" style={{ flex: 1 }}>
            2 · Paste its reply
          </Txt>
          <Button label="Paste" icon="clipboard" kind="ghost" onPress={paste} />
        </Row>
        <TextInput
          value={text}
          onChangeText={(v) => {
            setText(v);
            setError(null);
          }}
          multiline
          placeholder='{ "id": "thailand-2027", ... }'
          placeholderTextColor={colors.textMute}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ color: colors.text, minHeight: 180, maxHeight: 320, marginTop: space.md, padding: space.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, textAlignVertical: 'top', fontSize: 13 }}
        />
      </Card>
      {error && (
        <Row style={{ marginTop: space.md }}>
          <Icon name="alert-circle" color={colors.rose} />
          <Txt v="small" color={colors.rose} style={{ flex: 1 }}>
            {error}
          </Txt>
        </Row>
      )}
    </Screen>
  );
}
