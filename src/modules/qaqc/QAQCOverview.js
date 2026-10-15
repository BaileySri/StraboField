import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {ListItem} from '@rn-vui/base';
import {useDispatch, useSelector} from 'react-redux';

import {resolveQAQC, rulingColor, rulingLabel} from './qaqcParse';
import {isEmpty, truncateText} from '../../shared/helpers';
import ListEmptyText from '../../shared/ui/ListEmptyText';
import {setNotebookPageVisible} from '../notebook-panel/notebook.slice';

const QAQCOverview = ({page}) => {
  /* Data Hooks */

  const dispatch = useDispatch();
  const savedQAQC = useSelector(state => state.spot.selectedSpot?.properties?.qaqc);
  const qaqc = resolveQAQC(savedQAQC);

  /* View */

  return (
    <>
      {isEmpty(savedQAQC) ? (
        <ListEmptyText onPress={() => dispatch(setNotebookPageVisible(page.key))} text={'No QAQC'}/>
      ) : (
        <ListItem
          containerStyle={styles.listItem}
          onPress={() => dispatch(setNotebookPageVisible(page.key))}
        >
          <ListItem.Content style={{maxHeight: 300}}>
            <View style={styles.row}>
              <View style={[styles.badge, {backgroundColor: rulingColor(qaqc.ruling)}]}>
                <Text style={styles.badgeText}>{rulingLabel(qaqc.ruling)}</Text>
              </View>
              <Text style={styles.count}>{qaqc.completenessFactors.length} issue(s)</Text>
            </View>
            {/* Keep the truncated notes so the overview still carries the message */}
            {qaqc.notes
              ? <ListItem.Title style={styles.title}>{truncateText(qaqc.notes, 300)}</ListItem.Title>
              : null}
          </ListItem.Content>
        </ListItem>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 4,
    marginRight: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  count: {
    color: '#555555',
    fontSize: 11,
  },
  listItem: {
    padding: 10,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 4,
  },
  title: {
    color: '#000000',
    fontSize: 12,
  },
});

export default QAQCOverview;
