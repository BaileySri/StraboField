import {useEffect, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {useToast} from 'react-native-toast-notifications';
import {useSelector} from 'react-redux';

import {sendFactorReaction} from './qaqc_funcs';
import QAQCAdvice from './QAQCAdvice';
import {
  completenessPercent,
  resolveQAQC,
  rulingColor,
  rulingLabel,
} from './qaqcParse';
import TextInputModal from '../../shared/ui/TextInputModal';
import PageHeader from '../page/PageHeader';

// Reactions per spot, keyed by `${facet}:${factor}`. Persisted so the UI
// keeps its state across page changes and QAQC reruns.
const FACTOR_REACTION_KEY = 'qaqc.factorReactions';

const loadAllFactorReactions = () => {
  try {
    const raw = localStorage.getItem(FACTOR_REACTION_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return (obj && typeof obj === 'object') ? obj : {};
  }
 catch (err) {
    return {};
  }

};

const loadFactorReactions = (spotId) => {
  const all = loadAllFactorReactions();
  return all[spotId] || {};
};

const QAQC = ({page}) => {
  /* Data Hooks */

  const existingQAQC = useSelector(state => state.spot.selectedSpot?.properties?.qaqc);
  const spotName = useSelector(state => state.spot.selectedSpot?.properties?.name);
  const spotId = useSelector(state => state.spot.selectedSpot?.properties?.id);
  const encodedLogin = useSelector(state => state.user.encoded_login);
  const toast = useToast();

  /* Local State */

  const [disagree, setDisagree] = useState(null);
  const [reasonText, setReasonText] = useState('');
  const [submitted, setSubmitted] = useState(() => loadFactorReactions(spotId));
  const [sending, setSending] = useState(false);

  // The page stays mounted across spot changes, so re-read the stored
  // reactions whenever the selected spot changes.
  useEffect(() => {
    setSubmitted(loadFactorReactions(spotId));
    setDisagree(null);
    setReasonText('');
  }, [spotId]);

  /* Derived Variables */

  const qaqc = resolveQAQC(existingQAQC);
  const percent = completenessPercent(existingQAQC);
  const nIssues = (qaqc.completenessFactors || []).length;
  const nRichness = (qaqc.richnessFactors || []).length;

  /* Logic Helpers */

  const factorKey = (facet, factor) => `${facet}:${factor}`;

  // Reactions are stored per spot so they survive page changes and QAQC reruns.
  const saveReaction = (facet, factor, reaction) => {
    const all = loadAllFactorReactions();
    all[spotId] = {...(all[spotId] || {}), [factorKey(facet, factor)]: reaction};
    localStorage.setItem(FACTOR_REACTION_KEY, JSON.stringify(all));
  };

  const openDisagree = (facet, index, factor) => {
    if (submitted[factorKey(facet, factor)]) return;
    setReasonText('');
    setDisagree({facet, index, factor});
  };

  /* Event Handlers */

  const submitReaction = async (facet, factor, reaction, reason) => {
    if (!spotId) {
      toast.show('No spot id; cannot record a reaction.', {type: 'error', duration: 4000});
      return;
    }
    if (submitted[factorKey(facet, factor)]) return;

    setSending(true);
    try {
      await sendFactorReaction(spotId, facet, factor, reaction, reason, encodedLogin);
      setSubmitted(prev => ({...prev, [factorKey(facet, factor)]: reaction}));
      saveReaction(facet, factor, reaction);
      toast.show('Feedback recorded.', {type: 'success', duration: 2000});
    }
    catch (err) {
      console.error('sendFactorReaction failed', err);
      toast.show('Could not record feedback.', {type: 'error', duration: 4000});
    }
    finally {
      setSending(false);
      setDisagree(null);
    }
  };

  /* View */

  return (
    <View style={styles.container}>
      <PageHeader pageTitle={page.label}/>

      {!qaqc.present ? (
        <Text style={styles.empty}>
          Run QAQC by opening the Home Menu -{'>'} Datasets and then Dataset Detail for the dataset on which to
          run QAQC. Press the Run QAQC button.
        </Text>
      ) : (
        <ScrollView style={styles.scroll}>
          {/* Score header */}
          <View style={styles.scoreCard}>
            <View style={styles.scoreTop}>
              <View style={[styles.rulingBadge, {backgroundColor: rulingColor(qaqc.ruling)}]}>
                <Text style={styles.rulingBadgeText}>{rulingLabel(qaqc.ruling)}</Text>
              </View>
              <Text style={styles.scoreTitle}>Spot Completeness</Text>
            </View>

            <View style={styles.scoreStats}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{nIssues}</Text>
                <Text style={styles.statLabel}>missing field(s)</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{nRichness}</Text>
                <Text style={styles.statLabel}>enrichment ideas</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, percent === null ? styles.statValueMuted : '']}>
                  {percent === null ? '—' : `${percent}%`}
                </Text>
                <Text style={styles.statLabel}>completeness</Text>
              </View>
            </View>
            {spotName ? <Text style={styles.spotName}>{spotName}</Text> : null}
          </View>

          {/* Missing fields, grouped by facet */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>WHAT'S MISSING</Text>
            {qaqc.facets.length === 0 ? (
              <Text style={styles.sectionEmpty}>No completeness issues found for this spot.</Text>
            ) : qaqc.facets.map(facet => (
              <View key={facet.key} style={styles.facet}>
                <Text style={styles.facetLabel}>{facet.label}</Text>
                {facet.factors.map((factor, i) => {
                  const done = submitted[factorKey(facet.key, factor)];
                  // This row's disagree modal is open (reason being typed).
                  const disagreeOpen = disagree
                    && disagree.facet === facet.key && disagree.factor === factor;
                  // Hide only once the server has recorded the disagree.
                  if (done === 'disagree') return null;
                  return (
                    <View key={i} style={styles.facetRow}>
                      <Text numberOfLines={2} style={styles.facetItem}>• {factor}</Text>
                      <View style={styles.reactionButtons}>
                        <Text
                          accessibilityLabel={'Agree with this issue'}
                          onPress={() => submitReaction(facet.key, factor, 'agree', null)}
                          style={[styles.reactionBtn, done === 'agree' && styles.reactionBtnActive,
                            disagreeOpen && styles.reactionBtnDisabled,
                            sending && !done && {opacity: 0.5}]}
                        >
                          <Text style={styles.agreeIcon}>✓</Text>
                        </Text>
                        <Text
                          accessibilityLabel={'Disagree with this issue'}
                          onPress={() => openDisagree(facet.key, i, factor)}
                          style={[styles.reactionBtn, disagreeOpen && styles.reactionBtnActive,
                            done === 'agree' && styles.reactionBtnDisabled,
                            sending && !done && {opacity: 0.5}]}
                        >
                          <Text style={styles.disagreeIcon}>✗</Text>
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          {/* ML model score when applicable */}
          {qaqc.mlModel ? (
            <View style={styles.mlCard}>
              <Text style={styles.mlTitle}>ML MODEL</Text>
              <Text style={styles.mlText}>
                P(complete) = {Math.round(qaqc.mlModel.probability_complete * 100)}%
                {'  '}({qaqc.mlModel.call}, threshold {Math.round((qaqc.mlModel.threshold || 0) * 100)}%)
              </Text>
            </View>
          ) : null}

          {/* LLM suggestion */}
          {qaqc.advice ? <QAQCAdvice advice={qaqc.advice}/> : null}

          {/* Raw notes for debugging */}
          {qaqc.notes ? (
            <View style={styles.rawNotes}>
              <Text style={styles.sectionTitle}>RAW NOTES</Text>
              <Text style={styles.rawText}>{qaqc.notes}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* Disagree reason modal */}
      {disagree && (
        <TextInputModal
          buttonText={'Submit Disagreement'}
          dialogTitle={'Why do you disagree?'}
          multiline
          onActionPressed={() => submitReaction(disagree.facet, disagree.factor, 'disagree', reasonText)}
          onCancelPress={() => setDisagree(null)}
          onChangeText={setReasonText}
          placeholder={'Explain why this issue is not a real problem...'}
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
    flex: 1,
  },
  disagreeIcon: {
    color: '#c0392b',
    fontSize: 14,
    fontWeight: '700',
  },
  empty: {
    color: '#333333',
    fontSize: 12,
    padding: 10,
  },
  facet: {
    marginBottom: 8,
  },
  facetItem: {
    color: '#333333',
    flex: 1,
    fontSize: 12,
    paddingRight: 8,
  },
  facetLabel: {
    color: '#2471a3',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  facetRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    marginBottom: 4,
  },
  mlCard: {
    backgroundColor: '#eaf2f8',
    borderColor: '#a9cce3',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    padding: 10,
  },
  mlText: {
    color: '#1a5276',
    fontSize: 12,
  },
  mlTitle: {
    color: '#1a5276',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  rawNotes: {
    marginTop: 10,
  },
  rawText: {
    color: '#777777',
    fontFamily: 'monospace',
    fontSize: 11,
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
  rulingBadge: {
    borderRadius: 6,
    marginRight: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rulingBadgeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  scoreCard: {
    backgroundColor: '#ffffff',
    borderColor: '#d3d3d3',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12,
  },
  scoreStats: {
    flexDirection: 'row',
  },
  scoreTitle: {
    color: '#333333',
    fontSize: 13,
    fontWeight: '500',
  },
  scoreTop: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 10,
  },
  scroll: {
    flex: 1,
    padding: 10,
  },
  section: {
    marginBottom: 10,
  },
  sectionEmpty: {
    color: '#666666',
    fontSize: 12,
    fontStyle: 'italic',
  },
  sectionTitle: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  spotName: {
    color: '#666666',
    fontSize: 11,
    marginTop: 8,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    color: '#888888',
    fontSize: 10,
  },
  statValue: {
    color: '#1a5276',
    fontSize: 20,
    fontWeight: '700',
  },
  statValueMuted: {
    color: '#bbbbbb',
  },
});

export default QAQC;
