import {useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {useToast} from 'react-native-toast-notifications';
import {useSelector} from 'react-redux';

import TextInputModal from '../../shared/ui/TextInputModal';
import {sendAdviceReaction} from './qaqc_funcs';

// Severity: colour
const SEVERITY_COLORS = {
  error: '#c0392b',
  warning: '#e67e22',
  info: '#2471a3',
};
const SEVERITY_LABELS = {
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
};

// These are the reactions a user can send, an ignored reaction is registered
// if they run QAQC without having done anything to the Spot with QAQC notes
const REACTIONS = ['accepted', 'edited', 'rejected'];

const QAQCAdvice = ({advice}) => {

  /* Data Hooks */

  const encodedLogin = useSelector(state => state.user.encoded_login);
  const toast = useToast();

  /* Local State */

  // Which advice item is open in the edit modal.
  const [editingIndex, setEditingIndex] = useState(null);
  const [editText, setEditText] = useState('');
  // Reactions already sent this session, keyed by `${event_id}:${index}`.
  const [submitted, setSubmitted] = useState({});
  const [sending, setSending] = useState(false);

  const eventId = advice?.event_id;
  const items = advice?.items || [];

  const openEdit = index => {
    setEditText(items[index]?.action || '');
    setEditingIndex(index);
  };

  const submitReaction = async (index, reaction) => {
    if (!eventId) {
      toast.show('This advice has no event id; cannot record a reaction.', {type: 'error', duration: 4000});
      return;
    }
    const key = `${eventId}:${index}`;
    if (submitted[key]) return;

    setSending(true);
    try {
      await sendAdviceReaction(eventId, reaction, items[index]?.field,
        reaction === 'edited' ? editText : null, encodedLogin);
      setSubmitted(prev => ({...prev, [key]: reaction}));
      toast.show('Feedback recorded.', {type: 'success', duration: 2000});
    }
    catch (err) {
      console.error('sendAdviceReaction failed', err);
      toast.show('Could not record feedback.', {type: 'error', duration: 4000});
    }
    finally {
      setSending(false);
      setEditingIndex(null);
    }
  };

  /* View */

  if (!advice) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI SUGGESTIONS</Text>
        <Text style={styles.headerMeta}>
          {advice.model ? `${advice.model} · ` : ''}{advice.version ? `v${advice.version}` : ''}
        </Text>
      </View>

      {advice.summary ? <Text style={styles.summary}>{advice.summary}</Text> : null}

      {items.length === 0 ? (
        <Text style={styles.empty}>No specific suggestions. The spot's completeness issues are listed above.</Text>
      ) : (
        <ScrollView style={styles.list}>
          {items.map((item, index) => {
            const key = `${eventId}:${index}`;
            const done = submitted[key];
            return (
              <View key={key} style={styles.item}>
                <View style={[styles.itemBadge, {backgroundColor: SEVERITY_COLORS[item.severity] || '#888'}]}>
                  <Text style={styles.itemBadgeText}>{SEVERITY_LABELS[item.severity] || item.severity}</Text>
                </View>
                <View style={styles.itemBody}>
                  {item.field && item.field !== 'spot'
                    ? <Text style={styles.itemField}>{item.field}</Text>
                    : null}
                  <Text style={styles.itemAction}>{item.action}</Text>
                  {item.reason ? <Text style={styles.itemReason}>{item.reason}</Text> : null}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Per-issue reaction controls */}
      {items.length > 0 && eventId ? (
        <View style={styles.reactions}>
          <Text style={styles.reactionsHint}>React to each suggestion to help improve the model:</Text>
          {items.map((item, index) => {
            const key = `${eventId}:${index}`;
            const done = submitted[key];
            return (
              <View key={key} style={styles.reactionRow}>
                <Text style={styles.reactionLabel} numberOfLines={1}>{item.field && item.field !== 'spot' ? item.field : item.action}</Text>
                <View style={styles.reactionButtons}>
                  {REACTIONS.map(r => (
                    <Text
                      key={r}
                      onPress={() => (r === 'edited' ? openEdit(index) : submitReaction(index, r))}
                      style={[styles.reactionBtn, done === r && styles.reactionBtnActive,
                        sending && !done && {opacity: 0.5}]}
                    >
                      {done === r ? `✓ ${r}` : r}
                    </Text>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {advice.dropped_by_gate ? (
        <Text style={styles.dropped}>{advice.dropped_by_gate} suggestion(s) were filtered out by the validation gate (unverifiable fields).</Text>
      ) : null}

      {/* Edit modal for the 'edited' reaction */}
      {editingIndex !== null && (
        <TextInputModal
          buttonText={'Save Edit'}
          dialogTitle={'Edit Suggestion'}
          multiline
          onCancelPress={() => setEditingIndex(null)}
          onChangeText={setEditText}
          onActionPressed={() => submitReaction(editingIndex, 'edited')}
          placeholder={'Rewrite this suggestion...'}
          value={editText}
          visible
        />
      )}
    </View>
  );
};

// This styles is just for the LLM advice section when it appears
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f7f7f7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d3d3d3',
    marginVertical: 8,
    padding: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerTitle: {
    color: '#2471a3',
    fontSize: 12,
    fontWeight: '700',
  },
  headerMeta: {
    color: '#888888',
    fontSize: 10,
  },
  summary: {
    color: '#000000',
    fontSize: 12,
    marginBottom: 8,
  },
  empty: {
    color: '#666666',
    fontSize: 11,
    fontStyle: 'italic',
  },
  list: {
    marginBottom: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  itemBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  itemBody: {
    flex: 1,
  },
  itemField: {
    color: '#666666',
    fontSize: 10,
    fontWeight: '500',
  },
  itemAction: {
    color: '#000000',
    fontSize: 12,
  },
  itemReason: {
    color: '#555555',
    fontSize: 11,
  },
  reactions: {
    borderTopWidth: 1,
    borderTopColor: '#d3d3d3',
    paddingTop: 8,
  },
  reactionsHint: {
    color: '#555555',
    fontSize: 10,
    marginBottom: 6,
  },
  reactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  reactionLabel: {
    color: '#333333',
    fontSize: 11,
    flex: 1,
    marginRight: 8,
  },
  reactionButtons: {
    flexDirection: 'row',
  },
  reactionBtn: {
    color: '#2471a3',
    fontSize: 11,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: '#cfd8dc',
    borderRadius: 4,
  },
  reactionBtnActive: {
    backgroundColor: '#eaf2f8',
    color: '#1a5276',
    fontWeight: '700',
  },
  dropped: {
    color: '#888888',
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 6,
  },
});

export default QAQCAdvice;
