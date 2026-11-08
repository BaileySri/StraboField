import {getRequest} from '../../services/network/serverRequests.helpers';
import {QAQC_PATHS} from '../../services/network/urls.constants';

const basicAuth = token => ({type: 'basic', token});

// Timeout in seconds, applied server-side to the whole run
export const QAQC_TIMEOUT_S = 60;

export const startQAQC = async (dataset, projectID, encodedLogin, toast, toast_id,
  timeoutS = QAQC_TIMEOUT_S) => {
  // Check for dataset id and encoded login
  console.log('startQAQC()');
  if (!dataset.id) {
    console.error('Dataset ID is missing');
    throw new Error('Project ID is missing');
  }

  if (!encodedLogin) {
    console.error('User credentials are missing');
    throw new Error('User credentials are missing');
  }

  // Update toast to show dataset name
  toast.update(toast_id,
    `Started QAQC process for ${dataset.name}, please wait until download...`,
    {
      type: 'normal',
      animationType: 'slide-in',
      duration: 120000,
      placement: 'top',
    });

  try {
    const params = new URLSearchParams({
      'action': 'completeness',
      'plainreq': 'true',
      'doAnnotate': 'true',
      'pid': projectID,
      'dsid': dataset.id,
      'timeout': timeoutS,
    });

    // Give the server's own TIMEOUT message a chance to win
    const response = await getRequest(`${QAQC_PATHS.URL}/api.php?${params.toString()}`, basicAuth(encodedLogin),
      {responseType: 'document', timeout: timeoutS * 1000 + 5000});

    // Block until response
    await response.text();
    if (!response.ok) {
      toast.hide(toast_id);
      throw new Error(`HTTP error. status: ${response.status}`);
    }

    // Stall so the user downloads the notes before the local datasets desync
    for (let iter = 3; iter > 0; iter--) {
      toast.update(toast_id,
        `Downloading QAQC notes in ${iter} seconds.`,
        {type: 'warning'},
      );
      await new Promise(r => setTimeout(r, 1000));
    }

    toast.hide(toast_id);
    return response;
  }
  catch (err) {
    throw (err);
  }
};

// Send a reaction to the LLM suggestion for a spot. A disagree needs a reason.
export const sendAdviceReaction = async (eventId, reaction, reason, encodedLogin,
  timeoutS = QAQC_TIMEOUT_S) => {
  if (!eventId) throw new Error('event_id is required to record a reaction');
  if (!encodedLogin) throw new Error('User credentials are missing');

  const params = new URLSearchParams({
    'plainreq': 'true',
    'action': 'reaction',
    'event_id': eventId,
    'reaction': reaction,
    'timeout': timeoutS,
  });
  if (reason) params.set('reason', reason);

  const response = await getRequest(`${QAQC_PATHS.URL}/api.php?${params.toString()}`, basicAuth(encodedLogin),
    {timeout: timeoutS * 1000 + 5000});
  if (!response.ok) {
    throw new Error(`server rejected the reaction (HTTP ${response.status})`);
  }
  return response;
};

// Send an agree/disagree reaction to one completeness issue
export const sendFactorReaction = async (spotId, facet, factor, reaction, reason, encodedLogin,
  timeoutS = QAQC_TIMEOUT_S) => {
  if (!spotId) throw new Error('spot_id is required to record a factor reaction');
  if (!encodedLogin) throw new Error('User credentials are missing');

  const params = new URLSearchParams({
    'plainreq': 'true',
    'action': 'factor_reaction',
    'spot_id': spotId,
    'facet': facet,
    'factor': factor,
    'reaction': reaction,
    'timeout': timeoutS,
  });
  if (reason) params.set('reason', reason);

  const response = await getRequest(`${QAQC_PATHS.URL}/api.php?${params.toString()}`, basicAuth(encodedLogin),
    {timeout: timeoutS * 1000 + 5000});
  if (!response.ok) {
    throw new Error(`server rejected the reaction (HTTP ${response.status})`);
  }
  return response;
};

export const runQAQC = async (dataset, currentProjectId, encodedLogin, toast, toast_id,
  timeoutS = QAQC_TIMEOUT_S) => {
  console.log('runQAQC()');
  if (dataset && dataset.id) {
    try {
      return await startQAQC(dataset, currentProjectId, encodedLogin, toast, toast_id, timeoutS);
    }
    catch (err) {
      throw (err);
    }
  }
  else console.error('Target dataset or id is undefined!');
};
