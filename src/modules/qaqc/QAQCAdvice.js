import {useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {useToast} from 'react-native-toast-notifications';
import {useSelector} from 'react-redux';

import {sendAdviceReaction} from './qaqc_funcs';
import TextInputModal from '../../shared/ui/TextInputModal';

// Point badge colours by severity
const SEVERITY_COLORS = {
  error: '#c0392b',
  info: '#2471a3',
  warning: '#e67e22',
};

// Disagreed advice stays hidden until a new QAQC run makes a new event_id
const DISAGREED_STORAGE_KEY = 'qaqc.disagreedAdviceEventIds';

const loadDisagreedEventIds = () => {
  try {
    const raw = localStorage.getItem(DISAGREED_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  }
 catch (err) {
    return new Set();
  }

};

const persistDisagreedEventId = (eventId) => {
  try {
    const set = loadDisagreedEventIds();
    set.add(eventId);
    localStorage.setItem(DISAGREED_STORAGE_KEY, JSON.stringify(Array.from(set)));
  }
 catch (err) {
    console.warn('Could not persist disagreed advice id', err);
  }

};

const QAQCAdvice = ({advice}) => {
  /* Data Hooks */

  const encodedLogin = useSelector(state => state.user.encoded_login);
  const toast = useToast();

  /* Local State */

  const [done, setDone] = useState(() =>
    advice?.event_id && loadDisagreedEventIds().has(advice.event_id) ? 'disagree' : null,
  );
  const [sending, setSending] = useState(false);
  const [disagreeOpen, setDisagreeOpen] = useState(false);
  const [reasonText, setReasonText] = useState('');

  /* Derived Variables */

  const eventId = advice?.event_id;
  const points = advice?.points || [];

  /* Logic Helpers */

  const openDisagree = () => {
    if (done) return;
    setReasonText('');
    setDisagreeOpen(true);
  };

  /* Event Handlers */

  const submit = async (reaction, reason) => {
    if (!eventId) {
      toast.show('No suggestion id; cannot record a reaction.', {type: 'error', duration: 4000});
      return;
    }
    if (done) return;
    setSending(true);
    try {
      await sendAdviceReaction(eventId, reaction, reason, encodedLogin);
      setDone(reaction);
      if (reaction === 'disagree') persistDisagreedEventId(eventId);
      toast.show('Feedback recorded.', {type: 'success', duration: 2000});
    }
    catch (err) {
      console.error('sendAdviceReaction failed', err);
      toast.show('Could not record feedback.', {type: 'error', duration: 4000});
    }
    finally {
      setSending(false);
      setDisagreeOpen(false);
    }
  };

  /* View */

  if (!advice) return null;
  if (done === 'disagree') return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI SUGGESTION</Text>
        <Text style={styles.headerMeta}>
          {advice.model ? `${advice.model} · ` : ''}{advice.version ? `v${advice.version}` : ''}
        </Text>
      </View>

      {advice.summary ? <Text style={styles.summary}>{advice.summary}</Text> : null}

      {points.length > 0 ? (
        <ScrollView style={styles.list}>
          {points.map((p, index) => (
            <View key={index} style={styles.point}>
              <View style={[styles.pointBadge, {backgroundColor: SEVERITY_COLORS[p.severity] || '#888'}]}>
                <Text style={styles.pointBadgeText}>{(p.severity || '').toUpperCase()}</Text>
              </View>
              <View style={styles.pointBody}>
                {p.field && p.field !== 'spot'
                  ? <Text style={styles.pointField}>{p.field}</Text>
                  : null}
                <Text style={styles.pointAction}>{p.action}</Text>
                {p.reason ? <Text style={styles.pointReason}>{p.reason}</Text> : null}
              </View>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {advice.dropped_by_gate ? (
        <Text style={styles.dropped}>{advice.dropped_by_gate} suggestion(s) were filtered out by the validation gate (unverifiable fields).</Text>
      ) : null}

      {/* Agree/disagree reaction */}
      <View style={styles.reactRow}>
        <Text style={styles.reactPrompt}>Do you agree with this suggestion?</Text>
        <View style={styles.reactionButtons}>
          <Text
            accessibilityLabel={'Agree with this suggestion'}
            onPress={() => submit('agree', null)}
            style={[styles.reactionBtn, done === 'agree' && styles.reactionBtnActive,
              done === 'disagree' && styles.reactionBtnDisabled,
              sending && !done && {opacity: 0.5}]}
          >
            <Text style={styles.agreeIcon}>✓</Text>
          </Text>
          <Text
            accessibilityLabel={'Disagree with this suggestion'}
            onPress={openDisagree}
            style={[styles.reactionBtn, done === 'disagree' && styles.reactionBtnActive,
              done === 'agree' && styles.reactionBtnDisabled,
              sending && !done && {opacity: 0.5}]}
          >
            <Text style={styles.disagreeIcon}>✗</Text>
          </Text>
        </View>
      </View>

      {/* Disagree reason modal */}
      {disagreeOpen && (
        <TextInputModal
          buttonText={'Submit Disagreement'}
          dialogTitle={'Why do you disagree with this suggestion?'}
          multiline
          onActionPressed={() => submit('disagree', reasonText)}
          onCancelPress={() => setDisagreeOpen(false)}
          onChangeText={setReasonText}
          placeholder={'Explain why this suggestion is wrong or unhelpful...'}
          value={reasonText}
          visible
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  agreeIcon: {
    color: '#2e8b57',
    fontSize: 14,
    fontWeight: '700',
  },
  container: {
    backgroundColor: '#f7f7f7',
    borderColor: '#d3d3d3',
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 8,
    padding: 10,
  },
  disagreeIcon: {
    color: '#c0392b',
    fontSize: 14,
    fontWeight: '700',
  },
  dropped: {
    color: '#888888',
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 6,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerMeta: {
    color: '#888888',
    fontSize: 10,
  },
  headerTitle: {
    color: '#2471a3',
    fontSize: 12,
    fontWeight: '700',
  },
  list: {
    marginBottom: 8,
  },
  point: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    marginBottom: 8,
  },
  pointAction: {
    color: '#000000',
    fontSize: 12,
  },
  pointBadge: {
    borderRadius: 4,
    marginRight: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pointBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  pointBody: {
    flex: 1,
  },
  pointField: {
    color: '#666666',
    fontSize: 10,
    fontWeight: '500',
  },
  pointReason: {
    color: '#555555',
    fontSize: 11,
  },
  reactPrompt: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '500',
  },
  reactRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  reactionBtn: {
    borderColor: '#cfd8dc',
    borderRadius: 4,
    borderWidth: 1,
    color: '#2471a3',
    fontSize: 11,
    marginHorizontal: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reactionBtnActive: {
    backgroundColor: '#eaf2f8',
    color: '#1a5276',
    fontWeight: '700',
  },
  reactionBtnDisabled: {
    opacity: 0.3,
  },
  reactionButtons: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  summary: {
    color: '#000000',
    fontSize: 12,
    marginBottom: 8,
  },
});

export default QAQCAdvice;
