import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {useSelector} from 'react-redux';

import PageHeader from '../page/PageHeader';
import QAQCAdvice from './QAQCAdvice';
import {
  completenessPercent,
  resolveQAQC,
  rulingColor,
  rulingLabel,
} from './qaqcParse';

const QAQC = ({page}) => {
  /* Data Hooks */

  const existingQAQC = useSelector(state => state.spot.selectedSpot?.properties?.qaqc);
  const spotName = useSelector(state => state.spot.selectedSpot?.properties?.name);

  /* Local State */

  const qaqc = resolveQAQC(existingQAQC);
  const percent = completenessPercent(existingQAQC);
  const nIssues = (qaqc.completenessFactors || []).length;
  const nRichness = (qaqc.richnessFactors || []).length;

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
          {/* (b) Score / summary header */}
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

          {/* Per-facet breakdown of what's missing */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>WHAT'S MISSING</Text>
            {qaqc.facets.length === 0 ? (
              <Text style={styles.sectionEmpty}>No completeness issues found for this spot.</Text>
            ) : qaqc.facets.map(facet => (
              <View key={facet.key} style={styles.facet}>
                <Text style={styles.facetLabel}>{facet.label}</Text>
                {facet.factors.map((factor, i) => (
                  <Text key={i} style={styles.facetItem}>• {factor}</Text>
                ))}
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

          {/* LLM advice when applicable */}
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
    </View>
  );
};

// The following styles is for the QAQC page.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  scroll: {
    flex: 1,
    padding: 10,
  },
  empty: {
    color: '#333333',
    fontSize: 12,
    padding: 10,
  },
  // Score card
  scoreCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d3d3d3',
    padding: 12,
    marginBottom: 10,
  },
  scoreTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  rulingBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 10,
  },
  rulingBadgeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  scoreTitle: {
    color: '#333333',
    fontSize: 13,
    fontWeight: '500',
  },
  scoreStats: {
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: '#1a5276',
    fontSize: 20,
    fontWeight: '700',
  },
  statValueMuted: {
    color: '#bbbbbb',
  },
  statLabel: {
    color: '#888888',
    fontSize: 10,
  },
  spotName: {
    color: '#666666',
    fontSize: 11,
    marginTop: 8,
  },
  // Sections
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  sectionEmpty: {
    color: '#666666',
    fontSize: 12,
    fontStyle: 'italic',
  },
  facet: {
    marginBottom: 8,
  },
  facetLabel: {
    color: '#2471a3',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  facetItem: {
    color: '#333333',
    fontSize: 12,
    paddingLeft: 8,
  },
  // ML card
  mlCard: {
    backgroundColor: '#eaf2f8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a9cce3',
    padding: 10,
    marginBottom: 10,
  },
  mlTitle: {
    color: '#1a5276',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  mlText: {
    color: '#1a5276',
    fontSize: 12,
  },
  // Raw notes
  rawNotes: {
    marginTop: 10,
  },
  rawText: {
    color: '#777777',
    fontSize: 11,
    fontFamily: 'monospace',
  },
});

export default QAQC;
