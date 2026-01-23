import {
  CheckCircleOutline,
  Close,
  CopyAllTwoTone,
  FirstPage,
  HistoryToggleOff,
  ImportContacts,
  InfoOutlined,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  LastPage,
  Refresh,
  Send,
} from '@mui/icons-material';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogContent,
  Grid,
  IconButton,
  Paper,
  Tab,
  Table,
  TableBody,
  TableContainer,
  TableFooter,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Snackbar, { SnackbarCloseReason } from '@mui/material/Snackbar';
import { useTheme } from '@mui/material/styles';
import TableCell from '@mui/material/TableCell';
import { Coin, RequestQueueWithPromise, useGlobal } from 'qapp-core';
import {
  ChangeEvent,
  Key,
  MouseEvent,
  SyntheticEvent,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { NumericFormat } from 'react-number-format';
import QRCode from 'react-qr-code';
import coinLogoQORT from '../../assets/qort.png';
import {
  DECIMAL_ROUND_UP,
  EMPTY_STRING,
  QORT_1_UNIT,
  TIME_MINUTES_1,
  
  TIME_SECONDS_3,
  TIME_SECONDS_4,
} from '../../common/constants';
import {
  copyToClipboard,
  cropString,
  epochToAgo,
  humanFileSize,
  timeoutDelay,
} from '../../common/functions';
import WalletContext from '../../contexts/walletContext';
import {
  CustomWidthTooltip,
  SlideTransition,
  StyledTableCell,
  StyledTableRow,
  SubmitDialog,
  Transition,
  WalletButtons,
  WalletCard,
} from '../../styles/page-styles';
import { SearchTransactionsResponse } from '../../utils/Types.tsx';
import { AddressBookDialog } from '../../components/AddressBook/AddressBookDialog';

interface TablePaginationActionsProps {
  count: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (event: MouseEvent<HTMLButtonElement>, newPage: number) => void;
}

const addressToPrimaryName: any = {};
const requestQueueGetPrimaryName = new RequestQueueWithPromise(10);

export const getPrimaryAccountName = async (address: string) => {
  if (addressToPrimaryName[address]) return addressToPrimaryName[address];
  try {
    const primaryName = await requestQueueGetPrimaryName.enqueue(() =>
      qortalRequest({ action: 'GET_PRIMARY_NAME', address })
    );
    if (primaryName) addressToPrimaryName[address] = primaryName;
    return primaryName ?? EMPTY_STRING;
  } catch (e) {
    console.log(e);
  }
  return EMPTY_STRING;
};

export const replaceAddressesWithNames = async (
  data: SearchTransactionsResponse[]
) => {
  if (!data || data.length === 0) return;
  const addressToNames: { address: string; name?: string }[] = [];
  const namePromises: Promise<string>[] = [];

  const addAddressIfNotInArray = (address: string) => {
    const isAddressInArray = addressToNames.find(
      (arrayAddress) => arrayAddress.address === address
    );

    if (!isAddressInArray && address) {
      addressToNames.push({ address });
      namePromises.push(getPrimaryAccountName(address));
    }
  };

  data.map((d) => {
    addAddressIfNotInArray(d.creatorAddress);
    addAddressIfNotInArray(d.recipient);
  });

  const accountNames = await Promise.all(namePromises);
  addressToNames.map((value, index) => (value.name = accountNames[index]));

  const findName = (address: string) => {
    const data = addressToNames.find((d) => d.address === address);
    return data?.name || data?.address;
  };

  return data.map((d) => {
    const creatorAddress = findName(d.creatorAddress);
    const recipient = findName(d.recipient);
    return {
      ...d,
      creatorAddress,
      creatorAddressOriginal: d.creatorAddress,
      recipient,
      recipientOriginal: d.recipient,
    } as SearchTransactionsResponse;
  });
};

function TablePaginationActions(props: TablePaginationActionsProps) {
  const { t } = useTranslation(['core']);
  const theme = useTheme();
  const { count, page, rowsPerPage, onPageChange } = props;

  const handleFirstPageButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
    onPageChange(event, 0);
  };

  const handleBackButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
    onPageChange(event, page - 1);
  };

  const handleNextButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
    onPageChange(event, page + 1);
  };

  const handleLastPageButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
    onPageChange(event, Math.max(0, Math.ceil(count / rowsPerPage) - 1));
  };

  return (
    <Box sx={{ flexShrink: 0, ml: 2.5 }}>
      <IconButton
        onClick={handleFirstPageButtonClick}
        disabled={page === 0}
        aria-label={t('core:page.first', {
          postProcess: 'capitalizeAll',
        })}
      >
        {theme.direction === 'rtl' ? <LastPage /> : <FirstPage />}
      </IconButton>
      <IconButton
        onClick={handleBackButtonClick}
        disabled={page === 0}
        aria-label={t('core:page.previous', {
          postProcess: 'capitalizeAll',
        })}
      >
        {theme.direction === 'rtl' ? (
          <KeyboardArrowRight />
        ) : (
          <KeyboardArrowLeft />
        )}
      </IconButton>
      <IconButton
        onClick={handleNextButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label={t('core:page.next', {
          postProcess: 'capitalizeAll',
        })}
      >
        {theme.direction === 'rtl' ? (
          <KeyboardArrowLeft />
        ) : (
          <KeyboardArrowRight />
        )}
      </IconButton>
      <IconButton
        onClick={handleLastPageButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label={t('core:page.last', {
          postProcess: 'capitalizeAll',
        })}
      >
        {theme.direction === 'rtl' ? <FirstPage /> : <LastPage />}
      </IconButton>
    </Box>
  );
}

export default function QortalWallet() {
  const ADDRESS_MIN_LENGTH = 3;
  const ADDRESS_LOOKUP_DEBOUNCE_MS = 1000;

  const { t } = useTranslation(['core']);
  const theme = useTheme();

  const { address, nodeInfo } = useContext(WalletContext);
  const [walletBalanceQort, setWalletBalanceQort] = useState<any>(0);
  const [isLoadingWalletBalanceQort, setIsLoadingWalletBalanceQort] =
    useState<boolean>(true);
  const [paymentInfo, setPaymentInfo] = useState<any>([]);
  const [qortTxFee, setQortTxFee] = useState<number>(0);
  const [arbitraryInfo, setArbitraryInfo] = useState<any>([]);
  const [atInfo, setAtInfo] = useState<any>([]);
  const [groupInfo, setGroupInfo] = useState<any>([]);
  const [nameInfo, setNameInfo] = useState<any>([]);
  const [assetInfo, setAssetInfo] = useState<any>([]);
  const [pollInfo, setPollInfo] = useState<any>([]);
  const [rewardshareInfo, setRewardshareInfo] = useState<any>([]);
  const [allInfo, setAllInfo] = useState<any>([]);
  const [value, setValue] = useState('One');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [openQortAddressBook, setOpenQortAddressBook] = useState(false);
  const [addressBookPrefill, setAddressBookPrefill] = useState<{name: string, address: string} | null>(null);
  const [loadingRefreshQort, setLoadingRefreshQort] = useState(false);
  const [openQortSend, setOpenQortSend] = useState(false);
  const [openTxQortSubmit, setOpenTxQortSubmit] = useState(false);
  const [openSendQortSuccess, setOpenSendQortSuccess] = useState(false);
  const [openSendQortError, setOpenSendQortError] = useState(false);
  const [qortAmount, setQortAmount] = useState<number | undefined>(undefined);
  const [qortRecipient, setQortRecipient] = useState<string>(EMPTY_STRING);
  const [sendDisabled, setSendDisabled] = useState<boolean>(true);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [addressValidating, setAddressValidating] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);
  const [recipientTouched, setRecipientTouched] = useState(false);
  const userName = useGlobal().auth.name;
  
  const maxSendableQortCoin = () => {
    // manage the correct round up
    const value = (walletBalanceQort - qortTxFee).toString();
    const [integer, decimal = EMPTY_STRING] = value.split('.');
    const truncated = decimal.substring(0, DECIMAL_ROUND_UP).padEnd(DECIMAL_ROUND_UP, '0');
    let truncatedMaxSendableQortCoin: number = parseFloat(`${integer}.${truncated}`);
    return truncatedMaxSendableQortCoin;
  };
  
  const emptyRowsPayment =
    page > 0
      ? Math.max(0, (1 + page) * rowsPerPage - paymentInfo?.length || 0)
      : 0;
  const emptyRowsArbitrary =
    page > 0
      ? Math.max(0, (1 + page) * rowsPerPage - arbitraryInfo?.length || 0)
      : 0;
  const emptyRowsAt =
    page > 0 ? Math.max(0, (1 + page) * rowsPerPage - atInfo?.length || 0) : 0;
  const emptyRowsGroup =
    page > 0
      ? Math.max(0, (1 + page) * rowsPerPage - groupInfo?.length || 0)
      : 0;
  const emptyRowsName =
    page > 0
      ? Math.max(0, (1 + page) * rowsPerPage - nameInfo?.length || 0)
      : 0;
  const emptyRowsAsset =
    page > 0
      ? Math.max(0, (1 + page) * rowsPerPage - assetInfo?.length || 0)
      : 0;
  const emptyRowsPoll =
    page > 0
      ? Math.max(0, (1 + page) * rowsPerPage - pollInfo?.length || 0)
      : 0;
  const emptyRowsRewardshare =
    page > 0
      ? Math.max(0, (1 + page) * rowsPerPage - rewardshareInfo?.length || 0)
      : 0;
  const emptyRowsAll =
    page > 0 ? Math.max(0, (1 + page) * rowsPerPage - allInfo?.length || 0) : 0;

  const handleOpenAddressBook = () => {
    setOpenQortAddressBook(true);
  };

  const handleOpenAddressBookWithData = (name: string, addressValue: string) => {
    setAddressBookPrefill({ name, address: addressValue });
    setOpenQortAddressBook(true);
  };

  const handleCloseAddressBook = () => {
    setOpenQortAddressBook(false);
    setAddressBookPrefill(null);
  };

  const handleSelectAddress = (address: string, _name: string) => {
    setQortRecipient(address);
    setQortAmount(0);
    setOpenQortAddressBook(false);
    setOpenQortSend(true);
    setAmountError(null);
    setAmountTouched(false);
    setRecipientError(null);
    setRecipientTouched(true); // Trigger validation for QORT addresses
  };

  const handleChange = (_event: SyntheticEvent, newValue: string) => {
    setValue(newValue);
    setPage(0);
  };

  const handleChangePage = (
    _event: MouseEvent<HTMLButtonElement> | null,
    newPage: number
  ) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleOpenQortSend = () => {
    setQortAmount(0);
    setQortRecipient(EMPTY_STRING);
    setOpenQortSend(true);
    setAmountError(null);
    setAmountTouched(false);
    setRecipientError(null);
    setRecipientTouched(false);
  };

  const handleCloseQortSend = () => {
    setQortAmount(0);
    setQortRecipient(EMPTY_STRING);
    setOpenQortSend(false);
    setAmountError(null);
    setAmountTouched(false);
    setRecipientError(null);
    setRecipientTouched(false);
  };

  const handleCloseSendQortSuccess = (
    _event?: SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSendQortSuccess(false);
  };

  const handleCloseSendQortError = (
    _event?: SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSendQortError(false);
  };

  const handleSendMaxQort = () => {
    if (maxSendableQortCoin() <= 0) {
      setQortAmount(0);
    } else {
      setQortAmount(maxSendableQortCoin());
    }
  };

  // core validation (synchronous checks)
  const validateAmountLocal = useCallback(
    (amount?: number) => {
      const a =
        typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
      if (a <= 0) {
        setAmountError(
          t('core:message.error.amount_positive', {
            postProcess: 'capitalizeFirstChar',
          })
        );
        return false;
      }
      if (a > maxSendableQortCoin()) {
        setAmountError(
          t('core:message.error.amount_exceeds_balance', {
            maxAmount: maxSendableQortCoin(),
            postProcess: 'capitalizeFirstChar',
          })
        );
        return false;
      }
      setAmountError(null);
      return true;
    },
    [walletBalanceQort, qortTxFee, t]
  );

  // address lookup with debounce + cancel
  useEffect(() => {
    // Early exit: if recipient not touched, no validation needed
    if (!recipientTouched) {
      setRecipientError(null);
      setAddressValidating(false);
      return;
    }

    // Synchronous validations
    if (qortRecipient === EMPTY_STRING) {
      setRecipientError(t('core:message.error.recipient_required'));
      setAddressValidating(false);
      return;
    }

    if (qortRecipient.length < ADDRESS_MIN_LENGTH) {
      setRecipientError(t('core:message.error.recipient_too_short'));
      setAddressValidating(false);
      return;
    }

    // Perform debounced network lookup
    setAddressValidating(true);
    setRecipientError(null);

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const [addrRes, nameRes] = await Promise.all([
          fetch(`/addresses/validate/${encodeURIComponent(qortRecipient)}`, {
            signal: controller.signal,
          }).then(async (r) => {
            const json = await r.json();
            if (!json) {
              console.warn(`Invalid address format: ${qortRecipient}`);
              return { error: 'Invalid address' };
            }
            return json;
          }),
          fetch(`/names/${encodeURIComponent(qortRecipient)}`, {
            signal: controller.signal,
          }).then(async (r) => {
            if (!r.ok) {
              console.warn(`No name found: ${qortRecipient}`);
              return { error: 'Name not found' };
            }
            return r.json();
          }),
        ]);
        if (!addrRes?.error || !nameRes?.error) {
          setRecipientError(null);
        } else {
          setRecipientError(t('core:message.error.recipient_not_found'));
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.error('Recipient lookup failed:', err.message);
        setRecipientError(t('core:message.error.recipient_lookup_failed'));
      } finally {
        setAddressValidating(false);
      }
    }, ADDRESS_LOOKUP_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [qortRecipient, recipientTouched, t]);

  // Consolidated send button enablement - derived from all validation states
  useEffect(() => {
    const amountValid = validateAmountLocal(qortAmount);
    const recipientLocallyValid =
      !!qortRecipient && qortRecipient.length >= ADDRESS_MIN_LENGTH;
    const addressFound =
      !addressValidating &&
      recipientError === null &&
      recipientTouched &&
      recipientLocallyValid;

    const finalEnabled = amountValid && recipientLocallyValid && addressFound;
    setSendDisabled(!finalEnabled);
  }, [
    qortAmount,
    qortRecipient,
    addressValidating,
    recipientError,
    recipientTouched,
    validateAmountLocal,
  ]);

  // input handlers
  const onAmountChange = (values: { floatValue?: number }) => {
    const next = values.floatValue ?? 0;
    setQortAmount(next);
    // quick local validation
    validateAmountLocal(next);
  };

  const onAmountBlur = () => setAmountTouched(true);
  const onRecipientBlur = () => setRecipientTouched(true);

  const getQortalTransactions = useCallback(
    async (signal?: AbortSignal) => {
      setLoadingRefreshQort(true);

      const arbitraryLink = `/transactions/search?txType=ARBITRARY&address=${address}&confirmationStatus=CONFIRMED&limit=0&reverse=true`;
      const assetLink = `/transactions/search?txType=CANCEL_ASSET_ORDER&txType=CREATE_ASSET_ORDER&txType=ISSUE_ASSET&txType=TRANSFER_ASSET&txType=UPDATE_ASSET&address=${address}&confirmationStatus=CONFIRMED&limit=0&reverse=true`;
      const atLink = `/transactions/search?txType=AT&txType=DEPLOY_AT&txType=MESSAGE&address=${address}&confirmationStatus=CONFIRMED&limit=0&reverse=true`;
      const groupLink = `/transactions/search?txType=CREATE_GROUP&txType=UPDATE_GROUP&txType=ADD_GROUP_ADMIN&txType=REMOVE_GROUP_ADMIN&txType=GROUP_BAN&txType=CANCEL_GROUP_BAN&txType=GROUP_KICK&txType=GROUP_INVITE&txType=CANCEL_GROUP_INVITE&txType=JOIN_GROUP&txType=LEAVE_GROUP&txType=GROUP_APPROVAL&txType=SET_GROUP&address=${address}&confirmationStatus=CONFIRMED&limit=0&reverse=true`;
      const nameLink = `/transactions/search?txType=REGISTER_NAME&txType=UPDATE_NAME&txType=SELL_NAME&txType=CANCEL_SELL_NAME&txType=BUY_NAME&address=${address}&confirmationStatus=CONFIRMED&limit=0&reverse=true`;
      const paymentLink = `/transactions/search?txType=PAYMENT&address=${address}&confirmationStatus=CONFIRMED&limit=0&reverse=true`;
      const pendingArbitraryLink = `/transactions/unconfirmed?txType=ARBITRARY&creator=${address}&limit=0&reverse=true`;
      const pendingAssetLink = `/transactions/unconfirmed?txType=CANCEL_ASSET_ORDER&txType=CREATE_ASSET_ORDER&txType=ISSUE_ASSET&txType=TRANSFER_ASSET&txType=UPDATE_ASSET&creator=${address}&limit=0&reverse=true`;
      const pendingAtLink = `/transactions/unconfirmed?txType=AT&txType=DEPLOY_AT&txType=MESSAGE&creator=${address}&limit=0&reverse=true`;
      const pendingGroupLink = `/transactions/unconfirmed?txType=CREATE_GROUP&txType=UPDATE_GROUP&txType=ADD_GROUP_ADMIN&txType=REMOVE_GROUP_ADMIN&txType=GROUP_BAN&txType=CANCEL_GROUP_BAN&txType=GROUP_KICK&txType=GROUP_INVITE&txType=CANCEL_GROUP_INVITE&txType=JOIN_GROUP&txType=LEAVE_GROUP&txType=GROUP_APPROVAL&txType=SET_GROUP&creator=${address}&limit=0&reverse=true`;
      const pendingNameLink = `/transactions/unconfirmed?txType=REGISTER_NAME&txType=UPDATE_NAME&txType=SELL_NAME&txType=CANCEL_SELL_NAME&txType=BUY_NAME&creator=${address}&limit=0&reverse=true`;
      const pendingPaymentLink = `/transactions/unconfirmed?txType=PAYMENT&creator=${address}&limit=0&reverse=true`;
      const pendingPollLink = `/transactions/unconfirmed?txType=CREATE_POLL&txType=VOTE_ON_POLL&creator=${address}&limit=0&reverse=true`;
      const pendingRewardshareLink = `/transactions/unconfirmed?txType=REWARD_SHARE&txType=TRANSFER_PRIVS&txType=PRESENCE&creator=${address}&limit=0&reverse=true`;
      const pollLink = `/transactions/search?txType=CREATE_POLL&txType=VOTE_ON_POLL&address=${address}&confirmationStatus=CONFIRMED&limit=0&reverse=true`;
      const rewardshareLink = `/transactions/search?txType=REWARD_SHARE&txType=TRANSFER_PRIVS&txType=PRESENCE&address=${address}&confirmationStatus=CONFIRMED&limit=0&reverse=true`;

      const compareFn = (
        a: { timestamp: number },
        b: { timestamp: number }
      ) => {
        return b.timestamp - a.timestamp;
      };

      const toArray = (value: unknown) =>
        Array.isArray(value) ? value : ([] as any[]);

      const fetchPayment = async () => {
        const paymentResponse = await fetch(paymentLink, { signal });
        const pendingPaymentResponse = await fetch(pendingPaymentLink, {
          signal,
        });
        const paymentResult = await paymentResponse.json();
        const pendingPaymentResult = await pendingPaymentResponse.json();
        const allPayment = [
          ...toArray(paymentResult),
          ...toArray(pendingPaymentResult),
        ];
        const allPaymentSorted = (await replaceAddressesWithNames(
          allPayment.sort(compareFn)
        )) as any[];
        setPaymentInfo(allPaymentSorted);
        return allPaymentSorted;
      };

      const fetchArbitrary = async () => {
        const arbitraryResponse = await fetch(arbitraryLink, { signal });
        const pendingArbitraryResponse = await fetch(pendingArbitraryLink, {
          signal,
        });
        const arbitraryResult = await arbitraryResponse.json();
        const pendingArbitraryResult = await pendingArbitraryResponse.json();
        const allArbitrary = [
          ...toArray(arbitraryResult),
          ...toArray(pendingArbitraryResult),
        ];
        const allArbitrarySorted = (await replaceAddressesWithNames(
          allArbitrary.sort(compareFn)
        )) as any[];

        setArbitraryInfo(allArbitrarySorted);
        return allArbitrarySorted;
      };

      const fetchAt = async () => {
        const atResponse = await fetch(atLink, { signal });
        const pendingAtResponse = await fetch(pendingAtLink, { signal });
        const atResult = await atResponse.json();
        const pendingAtResult = await pendingAtResponse.json();
        const allAt = [...toArray(atResult), ...toArray(pendingAtResult)];
        const allAtSorted = (await replaceAddressesWithNames(
          allAt.sort(compareFn)
        )) as any[];

        setAtInfo(allAtSorted);
        return allAtSorted;
      };

      const fetchGroup = async () => {
        const groupResponse = await fetch(groupLink, { signal });
        const pendingGroupResponse = await fetch(pendingGroupLink, { signal });
        const groupResult = await groupResponse.json();
        const pendingGroupResult = await pendingGroupResponse.json();
        const allGroup = [
          ...toArray(groupResult),
          ...toArray(pendingGroupResult),
        ];
        const allGroupSorted = (await replaceAddressesWithNames(
          allGroup.sort(compareFn)
        )) as any[];
        setGroupInfo(allGroupSorted);
        return allGroupSorted;
      };

      const fetchName = async () => {
        const nameResponse = await fetch(nameLink, { signal });
        const pendingNameResponse = await fetch(pendingNameLink, { signal });
        const nameResult = await nameResponse.json();
        const pendingNameResult = await pendingNameResponse.json();
        const allName = [...toArray(nameResult), ...toArray(pendingNameResult)];
        const allNameSorted = (await replaceAddressesWithNames(
          allName.sort(compareFn)
        )) as any[];
        setNameInfo(allNameSorted);
        return allNameSorted;
      };

      const fetchAsset = async () => {
        const assetResponse = await fetch(assetLink, { signal });
        const pendingAssetResponse = await fetch(pendingAssetLink, { signal });
        const assetResult = await assetResponse.json();
        const pendingAssetResult = await pendingAssetResponse.json();
        const allAsset = [
          ...toArray(assetResult),
          ...toArray(pendingAssetResult),
        ];
        const allAssetSorted = (await replaceAddressesWithNames(
          allAsset.sort(compareFn)
        )) as any[];

        setAssetInfo(allAssetSorted);
        return allAssetSorted;
      };

      const fetchPoll = async () => {
        const pollResponse = await fetch(pollLink, { signal });
        const pendingPollResponse = await fetch(pendingPollLink, { signal });
        const pollResult = await pollResponse.json();
        const pendingPollResult = await pendingPollResponse.json();
        const allPoll = [...toArray(pollResult), ...toArray(pendingPollResult)];
        const allPollSorted = (await replaceAddressesWithNames(
          allPoll.sort(compareFn)
        )) as any[];

        setPollInfo(allPollSorted);
        return allPollSorted;
      };

      const fetchRewardshare = async () => {
        const rewardshareResponse = await fetch(rewardshareLink, { signal });
        const pendingRewardshareResponse = await fetch(pendingRewardshareLink, {
          signal,
        });
        const rewardshareResult = await rewardshareResponse.json();
        const pendingRewardshareResult =
          await pendingRewardshareResponse.json();
        const allRewardshare = [
          ...toArray(rewardshareResult),
          ...toArray(pendingRewardshareResult),
        ];
        const allRewardshareSorted = (await replaceAddressesWithNames(
          allRewardshare.sort(compareFn)
        )) as any[];

        setRewardshareInfo(allRewardshareSorted);
        return allRewardshareSorted;
      };

      try {
        const [
          arbitraries,
          assets,
          ats,
          groups,
          names,
          payments,
          polls,
          rewardshares,
        ] = await Promise.all([
          fetchPayment(),
          fetchArbitrary(),
          fetchAt(),
          fetchGroup(),
          fetchName(),
          fetchAsset(),
          fetchPoll(),
          fetchRewardshare(),
        ]);

        const combinedTransactions = [
          arbitraries,
          assets,
          ats,
          groups,
          names,
          payments,
          polls,
          rewardshares,
        ].reduce<any[]>((acc, list) => {
          if (Array.isArray(list)) {
            acc.push(...list);
          }
          return acc;
        }, []);

        setAllInfo(combinedTransactions.sort(compareFn));
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        console.error('Failed to fetch QORT transactions', error);
        setAllInfo([]);
      } finally {
        setLoadingRefreshQort(false);
      }
    },
    [address]
  );

  const handleLoadingRefreshQort = async () => {
    await getQortalTransactions();
  };

  const getWalletBalanceQort = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setIsLoadingWalletBalanceQort(true);
        const balanceLink = `/addresses/balance/${address}`;
        const response = await fetch(balanceLink, { signal });
        const data = await response.json();
        setWalletBalanceQort(data);
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        console.error(error);
      } finally {
        setIsLoadingWalletBalanceQort(false);
      }
    },
    [address]
  );

  useEffect(() => {
    if (!address) return;

    const controller = new AbortController();
    const intervalGetWalletBalance = setInterval(() => {
      getWalletBalanceQort();
    }, TIME_MINUTES_1);
    getWalletBalanceQort(controller.signal);

    return () => {
      clearInterval(intervalGetWalletBalance);
      controller.abort();
    };
  }, [address, getWalletBalanceQort]);

  useEffect(() => {
    let cancelled = false;

    const fetchQortTxFee = async () => {
      try {
        const res = await fetch('/transactions/unitfee?txType=PAYMENT');
        const rawFee = await res.json();

        if (!cancelled && typeof rawFee === 'number' && rawFee > 0) {
          setQortTxFee(rawFee / QORT_1_UNIT);
        }
      } catch (err) {
        console.error('Failed to fetch QORT tx fee', err);
      }
    };

    fetchQortTxFee();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!address) return;

    const controller = new AbortController();
    getQortalTransactions(controller.signal);

    return () => {
      controller.abort();
    };
  }, [address, getQortalTransactions]);

  const sendQortRequest = async () => {
    setOpenTxQortSubmit(true);
    try {
      const sendRequest = await qortalRequest({
        action: 'SEND_COIN',
        coin: Coin.QORT,
        recipient: qortRecipient,
        amount: qortAmount,
      });
      if (!sendRequest?.error) {
        setAmountError(null);
        setAmountTouched(false);
        setRecipientError(null);
        setRecipientTouched(false);

        setQortAmount(0);
        setQortRecipient(EMPTY_STRING);
        setOpenTxQortSubmit(false);
        setOpenSendQortSuccess(true);

        await timeoutDelay(TIME_SECONDS_3);
        getWalletBalanceQort();
        getQortalTransactions();
      }
    } catch (error) {
      setQortAmount(0);
      setQortRecipient(EMPTY_STRING);
      setOpenTxQortSubmit(false);
      setOpenSendQortError(true);
      await timeoutDelay(TIME_SECONDS_3);
      getWalletBalanceQort();
      getQortalTransactions();
      console.error('ERROR SENDING QORT', error);
    }
  };

  const tablePayment = () => {
    if (paymentInfo && paymentInfo.length > 0) {
      return (
        <>
          <TableContainer component={Paper}>
            <Table
              stickyHeader
              sx={{ width: '100%' }}
              aria-label="payments-table"
            >
              <TableHead>
                <TableRow>
                  <StyledTableCell align="center">
                    {t('core:status', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:type', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:creator', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:recipient', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:amount', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:fee.fee', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:time', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(rowsPerPage > 0
                  ? paymentInfo.slice(
                      page * rowsPerPage,
                      page * rowsPerPage + rowsPerPage
                    )
                  : paymentInfo
                ).map(
                  (
                    row: {
                      amount: number;
                      approvalStatus: string;
                      blockHeight: number;
                      creatorAddress: string;
                      creatorAddressOriginal?: string;
                      fee: number;
                      recipient: string;
                      recipientOriginal?: string;
                      reference: string;
                      senderPublicKey: string;
                      signature: string;
                      timestamp: number;
                      txGroupId: number;
                      type: string;
                    },
                    a: Key
                  ) => (
                    <StyledTableRow key={a}>
                      <StyledTableCell style={{ width: 'auto' }} align="center">
                        {(() => {
                          let confirmations: number =
                            nodeInfo?.height - row?.blockHeight;
                          if (confirmations < 3) {
                            return (
                              <Tooltip
                                placement="top"
                                title={t(
                                  'core:message.generic.confirmations_third',
                                  {
                                    postProcess: 'capitalizeFirstChar',
                                    count: confirmations,
                                  }
                                )}
                              >
                                <HistoryToggleOff
                                  style={{
                                    fontSize: '15px',
                                    color: theme.palette.error.main,
                                    marginTop: '2px',
                                  }}
                                />
                              </Tooltip>
                            );
                          } else {
                            let confirmations: number =
                              nodeInfo?.height - row?.blockHeight;
                            return (
                              <Tooltip
                                placement="top"
                                title={t('core:message.generic.confirmations', {
                                  postProcess: 'capitalizeFirstChar',
                                  count: confirmations,
                                })}
                              >
                                <CheckCircleOutline
                                  style={{
                                    fontSize: '15px',
                                    color: theme.palette.success.main,
                                    marginTop: '2px',
                                  }}
                                />
                              </Tooltip>
                            );
                          }
                        })()}
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        {row?.type}
                      </StyledTableCell>
                      <StyledTableCell
                        style={{ width: 'auto', cursor: 'pointer' }}
                        align="left"
                        title={t('core:action.double_click_addressbook', { address: row?.creatorAddressOriginal || row?.creatorAddress })}
                        onDoubleClick={() => handleOpenAddressBookWithData(row?.creatorAddress || EMPTY_STRING, row?.creatorAddressOriginal || row?.creatorAddress || EMPTY_STRING)}
                      >
                        {row?.creatorAddress === address ||
                        row?.creatorAddress === userName ? (
                          <Box style={{ color: theme.palette.info.main }}>
                            {row?.creatorAddress}
                          </Box>
                        ) : (
                          row?.creatorAddress
                        )}
                      </StyledTableCell>
                      <StyledTableCell
                        style={{ width: 'auto', cursor: 'pointer' }}
                        align="left"
                        title={t('core:action.double_click_addressbook', { address: row?.recipientOriginal || row?.recipient })}
                        onDoubleClick={() => handleOpenAddressBookWithData(row?.recipient || EMPTY_STRING, row?.recipientOriginal || row?.recipient || EMPTY_STRING)}
                      >
                        {row?.recipient === address ||
                        row?.recipient === userName ? (
                          <Box style={{ color: theme.palette.info.main }}>
                            {row?.recipient}
                          </Box>
                        ) : (
                          row?.recipient
                        )}
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        {row?.recipient === address ||
                        row?.recipient === userName ? (
                          <Box style={{ color: theme.palette.success.main }}>
                            + {row?.amount}
                          </Box>
                        ) : (
                          <Box style={{ color: theme.palette.error.main }}>
                            - {row?.amount}
                          </Box>
                        )}
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        {row?.fee}
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        <CustomWidthTooltip
                          placement="top"
                          title={new Date(row?.timestamp).toLocaleString()}
                        >
                          <Box>{epochToAgo(row?.timestamp)}</Box>
                        </CustomWidthTooltip>
                      </StyledTableCell>
                    </StyledTableRow>
                  )
                )}
                {emptyRowsPayment > 0 && (
                  <TableRow style={{ height: 53 * emptyRowsPayment }}>
                    <TableCell colSpan={7} />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div" // important when used outside <Table>
            labelRowsPerPage={t('core:rows_per_page', {
              postProcess: 'capitalizeFirstChar',
            })}
            rowsPerPageOptions={[5, 10, 25, { label: 'All', value: -1 }]}
            count={paymentInfo.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            ActionsComponent={TablePaginationActions}
          />
        </>
      );
    } else {
      return (
        <Typography
          variant="h5"
          align="center"
          sx={{ color: 'white', fontWeight: 700 }}
        >
          {t('core:message.generic.no_transactions', {
            postProcess: 'capitalizeFirstChar',
            transaction_type: 'PAYMENT',
          })}
        </Typography>
      );
    }
  };

  const tableArbitrary = () => {
    if (arbitraryInfo && arbitraryInfo.length > 0) {
      return (
        <TableContainer component={Paper}>
          <Table
            stickyHeader
            sx={{ width: '100%' }}
            aria-label="arbitrary-table"
          >
            <TableHead>
              <TableRow>
                <StyledTableCell align="center">
                  {t('core:status', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="center">
                  {t('core:type', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:creator', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:identifier', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:size', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:fee.fee', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:time', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(rowsPerPage > 0
                ? arbitraryInfo.slice(
                    page * rowsPerPage,
                    page * rowsPerPage + rowsPerPage
                  )
                : arbitraryInfo
              ).map(
                (
                  row: {
                    blockHeight: number;
                    type: string;
                    creatorAddress: string;
                    creatorAddressOriginal?: string;
                    identifier: string;
                    size: number;
                    fee: number;
                    timestamp: number;
                  },
                  b: Key
                ) => (
                  <StyledTableRow key={b}>
                    <StyledTableCell style={{ width: 'auto' }} align="center">
                      {(() => {
                        let confirmations: number =
                          nodeInfo?.height - row?.blockHeight;
                        if (confirmations < 3) {
                          return (
                            <Tooltip
                              placement="top"
                              title={t(
                                'core:message.generic.confirmations_third',
                                {
                                  postProcess: 'capitalizeFirstChar',
                                  count: confirmations,
                                }
                              )}
                            >
                              <HistoryToggleOff
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.error.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        } else {
                          return (
                            <Tooltip
                              placement="top"
                              title={t('core:message.generic.confirmations', {
                                postProcess: 'capitalizeFirstChar',
                                count: confirmations,
                              })}
                            >
                              <CheckCircleOutline
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.success.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        }
                      })()}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.type}
                    </StyledTableCell>
                    <StyledTableCell
                      style={{ width: 'auto', cursor: 'pointer' }}
                      align="left"
                      title={t('core:action.double_click_addressbook', { address: row?.creatorAddressOriginal || row?.creatorAddress })}
                      onDoubleClick={() => handleOpenAddressBookWithData(row?.creatorAddress || EMPTY_STRING, row?.creatorAddressOriginal || row?.creatorAddress || EMPTY_STRING)}
                    >
                      {row?.creatorAddress === address ||
                      row?.creatorAddress === userName ? (
                        <Box style={{ color: theme.palette.info.main }}>
                          {row?.creatorAddress}
                        </Box>
                      ) : (
                        row?.creatorAddress
                      )}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.identifier}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      <Box style={{ color: theme.palette.success.main }}>
                        {humanFileSize(row?.size, true, 2)}
                      </Box>
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.fee}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      <CustomWidthTooltip
                        placement="top"
                        title={new Date(row?.timestamp).toLocaleString()}
                      >
                        <Box>{epochToAgo(row?.timestamp)}</Box>
                      </CustomWidthTooltip>
                    </StyledTableCell>
                  </StyledTableRow>
                )
              )}
              {emptyRowsArbitrary > 0 && (
                <TableRow style={{ height: 53 * emptyRowsArbitrary }}>
                  <TableCell colSpan={7} />
                </TableRow>
              )}
            </TableBody>
            <TableFooter sx={{ width: '100%' }}>
              <TableRow>
                <TablePagination
                  labelRowsPerPage={t('core:rows_per_page', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                  rowsPerPageOptions={[5, 10, 25, { label: 'All', value: -1 }]}
                  colSpan={7}
                  count={arbitraryInfo.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  slotProps={{
                    select: {
                      inputProps: {
                        'aria-label': 'rows per page',
                      },
                      native: true,
                    },
                  }}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  ActionsComponent={TablePaginationActions}
                />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      );
    } else {
      return (
        <Typography
          variant="h5"
          align="center"
          sx={{ color: 'white', fontWeight: 700 }}
        >
          {t('core:message.generic.no_transactions', {
            postProcess: 'capitalizeFirstChar',
            transaction_type: 'ARBITRARY',
          })}
        </Typography>
      );
    }
  };

  const tableAt = () => {
    if (atInfo && atInfo.length > 0) {
      return (
        <TableContainer component={Paper}>
          <Table stickyHeader sx={{ width: '100%' }} aria-label="at-table">
            <TableHead>
              <TableRow>
                <StyledTableCell align="center">
                  {t('core:status', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="center">
                  {t('core:type', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:creator', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:recipient', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:amount', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:fee.fee', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:time', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(rowsPerPage > 0
                ? atInfo.slice(
                    page * rowsPerPage,
                    page * rowsPerPage + rowsPerPage
                  )
                : atInfo
              ).map(
                (
                  row: {
                    blockHeight: number;
                    type: string;
                    creatorAddress: string;
                    creatorAddressOriginal?: string;
                    recipient: string;
                    recipientOriginal?: string;
                    description: string | '';
                    amount: number;
                    fee: number;
                    timestamp: number;
                  },
                  c: Key
                ) => (
                  <StyledTableRow key={c}>
                    <StyledTableCell style={{ width: 'auto' }} align="center">
                      {(() => {
                        let confirmations: number =
                          nodeInfo?.height - row?.blockHeight;
                        if (confirmations < 3) {
                          return (
                            <Tooltip
                              placement="top"
                              title={t(
                                'core:message.generic.confirmations_third',
                                {
                                  postProcess: 'capitalizeFirstChar',
                                  count: confirmations,
                                }
                              )}
                            >
                              <HistoryToggleOff
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.error.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        } else {
                          return (
                            <Tooltip
                              placement="top"
                              title={t('core:message.generic.confirmations', {
                                postProcess: 'capitalizeFirstChar',
                                count: confirmations,
                              })}
                            >
                              <CheckCircleOutline
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.success.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        }
                      })()}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.type}
                    </StyledTableCell>
                    <StyledTableCell
                      style={{ width: 'auto', cursor: 'pointer' }}
                      align="left"
                      title={t('core:action.double_click_addressbook', { address: row?.creatorAddressOriginal || row?.creatorAddress })}
                      onDoubleClick={() => handleOpenAddressBookWithData(row?.creatorAddress || EMPTY_STRING, row?.creatorAddressOriginal || row?.creatorAddress || EMPTY_STRING)}
                    >
                      {row?.creatorAddress === address ||
                      row?.creatorAddress === userName ? (
                        <Box style={{ color: theme.palette.info.main }}>
                          {row?.creatorAddress}
                        </Box>
                      ) : (
                        row?.creatorAddress
                      )}
                    </StyledTableCell>
                    <StyledTableCell
                      style={{ width: 'auto', cursor: row?.recipientOriginal || row?.recipient ? 'pointer' : 'default' }}
                      align="left"
                      title={(row?.recipientOriginal || row?.recipient) ? t('core:action.double_click_addressbook', { address: row?.recipientOriginal || row?.recipient }) : undefined}
                      onDoubleClick={() => (row?.recipientOriginal || row?.recipient) && handleOpenAddressBookWithData(row?.recipient || EMPTY_STRING, row?.recipientOriginal || row?.recipient || EMPTY_STRING)}
                    >
                      {(() => {
                        if (row?.recipient) {
                          if (
                            row?.recipient === address ||
                            row?.recipient === userName
                          ) {
                            return (
                              <Box style={{ color: theme.palette.info.main }}>
                                {row?.recipient}
                              </Box>
                            );
                          } else {
                            return row?.recipient;
                          }
                        } else if (row?.description) {
                          return row?.description;
                        } else {
                          return EMPTY_STRING;
                        }
                      })()}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.recipient === address ||
                      row?.recipient === userName ? (
                        <Box style={{ color: theme.palette.success.main }}>
                          + {row?.amount}
                        </Box>
                      ) : (
                        <Box style={{ color: theme.palette.error.main }}>
                          - {row?.amount}
                        </Box>
                      )}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.fee}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      <CustomWidthTooltip
                        placement="top"
                        title={new Date(row?.timestamp).toLocaleString()}
                      >
                        <Box>{epochToAgo(row?.timestamp)}</Box>
                      </CustomWidthTooltip>
                    </StyledTableCell>
                  </StyledTableRow>
                )
              )}
              {emptyRowsAt > 0 && (
                <TableRow style={{ height: 53 * emptyRowsAt }}>
                  <TableCell colSpan={7} />
                </TableRow>
              )}
            </TableBody>
            <TableFooter sx={{ width: '100%' }}>
              <TableRow>
                <TablePagination
                  labelRowsPerPage={t('core:rows_per_page', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                  rowsPerPageOptions={[5, 10, 25, { label: 'All', value: -1 }]}
                  colSpan={7}
                  count={atInfo.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  slotProps={{
                    select: {
                      inputProps: {
                        'aria-label': 'rows per page',
                      },
                      native: true,
                    },
                  }}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  ActionsComponent={TablePaginationActions}
                />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      );
    } else {
      return (
        <Typography
          variant="h5"
          align="center"
          sx={{ color: 'white', fontWeight: 700 }}
        >
          {t('core:message.generic.no_transactions', {
            postProcess: 'capitalizeFirstChar',
            transaction_type: 'AT',
          })}
        </Typography>
      );
    }
  };

  const tableGroup = () => {
    if (groupInfo && groupInfo.length > 0) {
      return (
        <TableContainer component={Paper}>
          <Table stickyHeader sx={{ width: '100%' }} aria-label="group-table">
            <TableHead>
              <TableRow>
                <StyledTableCell align="center">
                  {t('core:status', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:type', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:creator', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:info', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:fee.fee', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:time', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(rowsPerPage > 0
                ? groupInfo.slice(
                    page * rowsPerPage,
                    page * rowsPerPage + rowsPerPage
                  )
                : groupInfo
              ).map(
                (
                  row: {
                    admin: string;
                    blockHeight: number;
                    creatorAddress: string;
                    creatorAddressOriginal?: string;
                    fee: number;
                    groupId: number;
                    groupName: string;
                    invitee: string;
                    member: string;
                    newDescription: string;
                    offender: string;
                    reference: string;
                    timestamp: number;
                    type: string;
                  },
                  d: Key
                ) => (
                  <StyledTableRow key={d}>
                    <StyledTableCell style={{ width: 'auto' }} align="center">
                      {(() => {
                        let confirmations: number =
                          nodeInfo?.height - row?.blockHeight;
                        if (confirmations < 3) {
                          return (
                            <Tooltip
                              placement="top"
                              title={t(
                                'core:message.generic.confirmations_third',
                                {
                                  postProcess: 'capitalizeFirstChar',
                                  count: confirmations,
                                }
                              )}
                            >
                              <HistoryToggleOff
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.error.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        } else {
                          return (
                            <Tooltip
                              placement="top"
                              title={t('core:message.generic.confirmations', {
                                postProcess: 'capitalizeFirstChar',
                                count: confirmations,
                              })}
                            >
                              <CheckCircleOutline
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.success.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        }
                      })()}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.type}
                    </StyledTableCell>
                    <StyledTableCell
                      style={{ width: 'auto', cursor: 'pointer' }}
                      align="left"
                      title={t('core:action.double_click_addressbook', { address: row?.creatorAddressOriginal || row?.creatorAddress })}
                      onDoubleClick={() => handleOpenAddressBookWithData(row?.creatorAddress || EMPTY_STRING, row?.creatorAddressOriginal || row?.creatorAddress || EMPTY_STRING)}
                    >
                      {row?.creatorAddress === address ||
                      row?.creatorAddress === userName ? (
                        <Box style={{ color: theme.palette.info.main }}>
                          {row?.creatorAddress}
                        </Box>
                      ) : (
                        row?.creatorAddress
                      )}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {(() => {
                        if (row?.type === 'CREATE_GROUP') {
                          return t('core:message.group_actions.create_group', {
                            groupName: row?.groupName,
                            id: row?.groupId,
                            postProcess: 'capitalizeFirstChar',
                          });
                        } else if (row?.type === 'UPDATE_GROUP') {
                          return t('core:message.group_actions.update_group', {
                            newDescription: row?.newDescription,
                            id: row?.groupId,
                            postProcess: 'capitalizeFirstChar',
                          });
                        } else if (row?.type === 'ADD_GROUP_ADMIN') {
                          return t(
                            'core:message.group_actions.add_group_admin',
                            {
                              member: row?.member,
                              id: row?.groupId,
                              postProcess: 'capitalizeFirstChar',
                            }
                          );
                        } else if (row?.type === 'REMOVE_GROUP_ADMIN') {
                          return t(
                            'core:message.group_actions.remove_group_admin',
                            {
                              admn: row?.admin,
                              id: row?.groupId,
                              postProcess: 'capitalizeFirstChar',
                            }
                          );
                        } else if (row?.type === 'GROUP_BAN') {
                          return t('core:message.group_actions.group_ban', {
                            offender: row?.offender,
                            id: row?.groupId,
                            postProcess: 'capitalizeFirstChar',
                          });
                        } else if (row?.type === 'CANCEL_GROUP_BAN') {
                          return t(
                            'core:message.group_actions.cancel_group_ban',
                            {
                              member: row?.member,
                              id: row?.groupId,
                              postProcess: 'capitalizeFirstChar',
                            }
                          );
                        } else if (row?.type === 'GROUP_KICK') {
                          return t('core:message.group_actions.group_kick', {
                            member: row?.member,
                            id: row?.groupId,
                            postProcess: 'capitalizeFirstChar',
                          });
                        } else if (row?.type === 'GROUP_INVITE') {
                          if (row?.invitee === address) {
                            return (
                              <Box>
                                <Trans
                                  i18nKey="message.group_actions.group_invite"
                                  values={{
                                    invitee: row?.invitee,
                                    id: row?.groupId,
                                  }}
                                  components={{
                                    blue: (
                                      <span
                                        style={{
                                          color: theme.palette.info.main,
                                          marginLeft: '5px',
                                          marginRight: '5px',
                                        }}
                                      />
                                    ),
                                  }}
                                />
                              </Box>
                            );
                          } else {
                            return (
                              'Invitee: ' +
                              row?.invitee +
                              ' ID: ' +
                              row?.groupId
                            );
                          }
                        } else if (row?.type === 'CANCEL_GROUP_INVITE') {
                          return t('core:message.group_actions.reference', {
                            reference: row?.reference,
                            postProcess: 'capitalizeFirstChar',
                          });
                        } else if (row?.type === 'JOIN_GROUP') {
                          return t('core:message.group_actions.join_group', {
                            id: row?.groupId,
                            postProcess: 'capitalizeFirstChar',
                          });
                        } else if (row?.type === 'LEAVE_GROUP') {
                          return t('core:message.group_actions.leave_group', {
                            id: row?.groupId,
                            postProcess: 'capitalizeFirstChar',
                          });
                        } else if (row?.type === 'GROUP_APPROVAL') {
                          return t('core:message.group_actions.reference', {
                            reference: row?.reference,
                            postProcess: 'capitalizeFirstChar',
                          });
                        } else if (row?.type === 'SET_GROUP') {
                          return EMPTY_STRING;
                        }
                      })()}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.fee}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      <CustomWidthTooltip
                        placement="top"
                        title={new Date(row?.timestamp).toLocaleString()}
                      >
                        <Box>{epochToAgo(row?.timestamp)}</Box>
                      </CustomWidthTooltip>
                    </StyledTableCell>
                  </StyledTableRow>
                )
              )}
              {emptyRowsGroup > 0 && (
                <TableRow style={{ height: 53 * emptyRowsGroup }}>
                  <TableCell colSpan={6} />
                </TableRow>
              )}
            </TableBody>
            <TableFooter sx={{ width: '100%' }}>
              <TableRow>
                <TablePagination
                  labelRowsPerPage={t('core:rows_per_page', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                  rowsPerPageOptions={[5, 10, 25, { label: 'All', value: -1 }]}
                  colSpan={6}
                  count={groupInfo.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  slotProps={{
                    select: {
                      inputProps: {
                        'aria-label': 'rows per page',
                      },
                      native: true,
                    },
                  }}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  ActionsComponent={TablePaginationActions}
                />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      );
    } else {
      return (
        <Typography
          variant="h5"
          align="center"
          sx={{ color: 'white', fontWeight: 700 }}
        >
          {t('core:message.generic.no_transactions', {
            postProcess: 'capitalizeFirstChar',
            transaction_type: 'GROUP',
          })}
        </Typography>
      );
    }
  };

  const tableName = () => {
    if (nameInfo && nameInfo.length > 0) {
      return (
        <TableContainer component={Paper}>
          <Table stickyHeader sx={{ width: '100%' }} aria-label="group-table">
            <TableHead>
              <TableRow>
                <StyledTableCell align="center">
                  {t('core:status', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:type', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:creator', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:info', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:fee.fee', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:time', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(rowsPerPage > 0
                ? nameInfo.slice(
                    page * rowsPerPage,
                    page * rowsPerPage + rowsPerPage
                  )
                : nameInfo
              ).map(
                (
                  row: {
                    blockHeight: number;
                    type: string;
                    creatorAddress: string;
                    name: string;
                    newName: string;
                    seller: string;
                    amount: number;
                    fee: number;
                    timestamp: number;
                  },
                  e: Key
                ) => (
                  <StyledTableRow key={e}>
                    <StyledTableCell style={{ width: 'auto' }} align="center">
                      {(() => {
                        let confirmations: number =
                          nodeInfo?.height - row?.blockHeight;
                        if (confirmations < 3) {
                          return (
                            <Tooltip
                              placement="top"
                              title={t(
                                'core:message.generic.confirmations_third',
                                {
                                  postProcess: 'capitalizeFirstChar',
                                  count: confirmations,
                                }
                              )}
                            >
                              <HistoryToggleOff
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.error.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        } else {
                          return (
                            <Tooltip
                              placement="top"
                              title={t('core:message.generic.confirmations', {
                                postProcess: 'capitalizeFirstChar',
                                count: confirmations,
                              })}
                            >
                              <CheckCircleOutline
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.success.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        }
                      })()}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.type}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.creatorAddress === address ||
                      row?.creatorAddress === userName ? (
                        <Box style={{ color: theme.palette.info.main }}>
                          {row?.creatorAddress}
                        </Box>
                      ) : (
                        row?.creatorAddress
                      )}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {(() => {
                        if (row?.type === 'REGISTER_NAME') {
                          return t('core:qortal.registered_name', {
                            name: row?.name,
                            postProcess: 'capitalizeFirstChar',
                          });
                        } else if (row?.type === 'UPDATE_NAME') {
                          return t('core:qortal.old_new_name', {
                            oldName: row?.name,
                            newName: row?.newName,
                            postProcess: 'capitalizeFirstChar',
                          });
                        } else if (row?.type === 'SELL_NAME') {
                          return t('core:qortal.name_to_sell', {
                            name: row?.name,
                            amount: row?.amount,
                            postProcess: 'capitalizeFirstChar',
                          });
                        } else if (row?.type === 'CANCEL_SELL_NAME') {
                          return t('core:qortal.cancelled_name_sale', {
                            name: row?.name,
                            postProcess: 'capitalizeFirstChar',
                          });
                        } else if (row?.type === 'BUY_NAME') {
                          return t('core:qortal.seller', {
                            seller: row?.seller,
                            amount: row?.amount,
                            postProcess: 'capitalizeFirstChar',
                          });
                        }
                      })()}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.fee}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      <CustomWidthTooltip
                        placement="top"
                        title={new Date(row?.timestamp).toLocaleString()}
                      >
                        <Box>{epochToAgo(row?.timestamp)}</Box>
                      </CustomWidthTooltip>
                    </StyledTableCell>
                  </StyledTableRow>
                )
              )}
              {emptyRowsName > 0 && (
                <TableRow style={{ height: 53 * emptyRowsName }}>
                  <TableCell colSpan={6} />
                </TableRow>
              )}
            </TableBody>
            <TableFooter sx={{ width: '100%' }}>
              <TableRow>
                <TablePagination
                  labelRowsPerPage={t('core:rows_per_page', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                  rowsPerPageOptions={[5, 10, 25, { label: 'All', value: -1 }]}
                  colSpan={6}
                  count={nameInfo.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  slotProps={{
                    select: {
                      inputProps: {
                        'aria-label': 'rows per page',
                      },
                      native: true,
                    },
                  }}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  ActionsComponent={TablePaginationActions}
                />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      );
    } else {
      return (
        <Typography
          variant="h5"
          align="center"
          sx={{ color: 'white', fontWeight: 700 }}
        >
          {t('core:message.generic.no_transactions', {
            postProcess: 'capitalizeFirstChar',
            transaction_type: 'NAME',
          })}
        </Typography>
      );
    }
  };

  const tableAsset = () => {
    if (assetInfo && assetInfo.length > 0) {
      return (
        <TableContainer component={Paper}>
          <Table stickyHeader sx={{ width: '100%' }} aria-label="group-table">
            <TableHead>
              <TableRow>
                <StyledTableCell align="center">
                  {t('core:status', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:type', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:creator', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:recipient', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:amount', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:fee.fee', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:time', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(rowsPerPage > 0
                ? assetInfo.slice(
                    page * rowsPerPage,
                    page * rowsPerPage + rowsPerPage
                  )
                : assetInfo
              ).map(
                (
                  row: {
                    amount: number;
                    assetName: string;
                    blockHeight: number;
                    creatorAddress: string;
                    description: string;
                    fee: number;
                    quantity: number;
                    recipient: string;
                    timestamp: number;
                    type: string;
                  },
                  f: Key
                ) => (
                  <StyledTableRow key={f}>
                    <StyledTableCell style={{ width: 'auto' }} align="center">
                      {(() => {
                        let confirmations: number =
                          nodeInfo?.height - row?.blockHeight;
                        if (confirmations < 3) {
                          return (
                            <Tooltip
                              placement="top"
                              title={t(
                                'core:message.generic.confirmations_third',
                                {
                                  postProcess: 'capitalizeFirstChar',
                                  count: confirmations,
                                }
                              )}
                            >
                              <HistoryToggleOff
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.error.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        } else {
                          return (
                            <Tooltip
                              placement="top"
                              title={t('core:message.generic.confirmations', {
                                postProcess: 'capitalizeFirstChar',
                                count: confirmations,
                              })}
                            >
                              <CheckCircleOutline
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.success.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        }
                      })()}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.type}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.creatorAddress === address ||
                      row?.creatorAddress === userName ? (
                        <Box style={{ color: theme.palette.info.main }}>
                          {row?.creatorAddress}
                        </Box>
                      ) : (
                        row?.creatorAddress
                      )}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {(() => {
                        if (row?.type === 'TRANSFER_ASSET') {
                          return row?.recipient === address ||
                            row?.recipient === userName ? (
                            <Box style={{ color: theme.palette.info.main }}>
                              {row?.recipient}
                            </Box>
                          ) : (
                            row?.recipient
                          );
                        } else if (row?.type === 'ISSUE_ASSET') {
                          return t('core:qortal.asset_name', {
                            name: row?.assetName,
                            postProcess: 'capitalizeFirstChar',
                          });
                        }
                      })()}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.amount ? row?.amount : row?.quantity}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.fee}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      <CustomWidthTooltip
                        placement="top"
                        title={new Date(row?.timestamp).toLocaleString()}
                      >
                        <Box>{epochToAgo(row?.timestamp)}</Box>
                      </CustomWidthTooltip>
                    </StyledTableCell>
                  </StyledTableRow>
                )
              )}
              {emptyRowsAsset > 0 && (
                <TableRow style={{ height: 53 * emptyRowsAsset }}>
                  <TableCell colSpan={7} />
                </TableRow>
              )}
            </TableBody>
            <TableFooter sx={{ width: '100%' }}>
              <TableRow>
                <TablePagination
                  labelRowsPerPage={t('core:rows_per_page', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                  rowsPerPageOptions={[5, 10, 25, { label: 'All', value: -1 }]}
                  colSpan={7}
                  count={assetInfo.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  slotProps={{
                    select: {
                      inputProps: {
                        'aria-label': 'rows per page',
                      },
                      native: true,
                    },
                  }}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  ActionsComponent={TablePaginationActions}
                />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      );
    } else {
      return (
        <Typography
          variant="h5"
          align="center"
          sx={{ color: 'white', fontWeight: 700 }}
        >
          {t('core:message.generic.no_transactions', {
            postProcess: 'capitalizeFirstChar',
            transaction_type: 'ASSET',
          })}
        </Typography>
      );
    }
  };

  const tablePoll = () => {
    if (pollInfo && pollInfo.length > 0) {
      return (
        <TableContainer component={Paper}>
          <Table stickyHeader sx={{ width: '100%' }} aria-label="group-table">
            <TableHead>
              <TableRow>
                <StyledTableCell align="center">
                  {t('core:status', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="center">
                  {t('core:type', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:creator', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:poll_name', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:fee.fee', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:time', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(rowsPerPage > 0
                ? pollInfo.slice(
                    page * rowsPerPage,
                    page * rowsPerPage + rowsPerPage
                  )
                : pollInfo
              ).map(
                (
                  row: {
                    blockHeight: number;
                    creatorAddress: string;
                    fee: number;
                    pollName: string;
                    timestamp: number;
                    type: string;
                  },
                  g: Key
                ) => (
                  <StyledTableRow key={g}>
                    <StyledTableCell style={{ width: 'auto' }} align="center">
                      {(() => {
                        let confirmations: number =
                          nodeInfo?.height - row?.blockHeight;
                        if (confirmations < 3) {
                          return (
                            <Tooltip
                              placement="top"
                              title={t(
                                'core:message.generic.confirmations_third',
                                {
                                  postProcess: 'capitalizeFirstChar',
                                  count: confirmations,
                                }
                              )}
                            >
                              <HistoryToggleOff
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.error.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        } else {
                          return (
                            <Tooltip
                              placement="top"
                              title={t('core:message.generic.confirmations', {
                                postProcess: 'capitalizeFirstChar',
                                count: confirmations,
                              })}
                            >
                              <CheckCircleOutline
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.success.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        }
                      })()}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.type}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.creatorAddress === address ||
                      row?.creatorAddress === userName ? (
                        <Box style={{ color: theme.palette.info.main }}>
                          {row?.creatorAddress}
                        </Box>
                      ) : (
                        row?.creatorAddress
                      )}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.pollName}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.fee}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      <CustomWidthTooltip
                        placement="top"
                        title={new Date(row?.timestamp).toLocaleString()}
                      >
                        <Box>{epochToAgo(row?.timestamp)}</Box>
                      </CustomWidthTooltip>
                    </StyledTableCell>
                  </StyledTableRow>
                )
              )}
              {emptyRowsPoll > 0 && (
                <TableRow style={{ height: 53 * emptyRowsPoll }}>
                  <TableCell colSpan={6} />
                </TableRow>
              )}
            </TableBody>
            <TableFooter sx={{ width: '100%' }}>
              <TableRow>
                <TablePagination
                  labelRowsPerPage={t('core:rows_per_page', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                  rowsPerPageOptions={[5, 10, 25, { label: 'All', value: -1 }]}
                  colSpan={6}
                  count={pollInfo.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  slotProps={{
                    select: {
                      inputProps: {
                        'aria-label': 'rows per page',
                      },
                      native: true,
                    },
                  }}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  ActionsComponent={TablePaginationActions}
                />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      );
    } else {
      return (
        <Typography
          variant="h5"
          align="center"
          sx={{ color: 'white', fontWeight: 700 }}
        >
          {t('core:message.generic.no_transactions', {
            postProcess: 'capitalizeFirstChar',
            transaction_type: 'POLL',
          })}
        </Typography>
      );
    }
  };

  const tableRewardshare = () => {
    if (rewardshareInfo && rewardshareInfo.length > 0) {
      return (
        <TableContainer component={Paper}>
          <Table
            stickyHeader
            sx={{ width: '100%' }}
            aria-label="payments-table"
          >
            <TableHead>
              <TableRow>
                <StyledTableCell align="center">
                  {t('core:status', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:type', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:creator', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:recipient', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:info', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:fee.fee', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
                <StyledTableCell align="left">
                  {t('core:time', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(rowsPerPage > 0
                ? rewardshareInfo.slice(
                    page * rowsPerPage,
                    page * rowsPerPage + rowsPerPage
                  )
                : rewardshareInfo
              ).map(
                (
                  row: {
                    blockHeight: number;
                    creatorAddress: string;
                    fee: number;
                    recipient: string;
                    rewardSharePublicKey: string;
                    sharePercent: string;
                    timestamp: number;
                    type: string;
                  },
                  h: Key
                ) => (
                  <StyledTableRow key={h}>
                    <StyledTableCell style={{ width: 'auto' }} align="center">
                      {(() => {
                        let confirmations: number =
                          nodeInfo?.height - row?.blockHeight;
                        if (confirmations < 3) {
                          return (
                            <Tooltip
                              placement="top"
                              title={t(
                                'core:message.generic.confirmations_third',
                                {
                                  postProcess: 'capitalizeFirstChar',
                                  count: confirmations,
                                }
                              )}
                            >
                              <HistoryToggleOff
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.error.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        } else {
                          return (
                            <Tooltip
                              placement="top"
                              title={t('core:message.generic.confirmations', {
                                postProcess: 'capitalizeFirstChar',
                                count: confirmations,
                              })}
                            >
                              <CheckCircleOutline
                                style={{
                                  fontSize: '15px',
                                  color: theme.palette.success.main,
                                  marginTop: '2px',
                                }}
                              />
                            </Tooltip>
                          );
                        }
                      })()}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.type}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.creatorAddress === address ||
                      row?.creatorAddress === userName ? (
                        <Box style={{ color: theme.palette.info.main }}>
                          {row?.creatorAddress}
                        </Box>
                      ) : (
                        row?.creatorAddress
                      )}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.recipient === address ||
                      row?.recipient === userName ? (
                        <Box style={{ color: theme.palette.info.main }}>
                          {row?.recipient}
                        </Box>
                      ) : (
                        row?.recipient
                      )}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.sharePercent?.startsWith('-') ? (
                        <Box
                          style={{
                            color: theme.palette.error.main,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          {t('core:qortal.removed', {
                            postProcess: 'capitalizeFirstChar',
                          })}
                          <CustomWidthTooltip
                            placement="top"
                            title={
                              row?.recipient === row?.creatorAddress
                                ? 'Minting Key: ' + row?.rewardSharePublicKey
                                : EMPTY_STRING
                            }
                          >
                            <InfoOutlined
                              style={{
                                fontSize: '14px',
                                color: theme.palette.info.main,
                                marginLeft: '8px',
                              }}
                            />
                          </CustomWidthTooltip>
                        </Box>
                      ) : (
                        <Box
                          style={{
                            color: theme.palette.success.main,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          {t('core:qortal.created', {
                            postProcess: 'capitalizeFirstChar',
                          })}
                          <CustomWidthTooltip
                            placement="top"
                            title={
                              row?.recipient === row?.creatorAddress ||
                              row?.recipient === userName
                                ? 'Minting Key: ' + row?.rewardSharePublicKey
                                : EMPTY_STRING
                            }
                          >
                            <InfoOutlined
                              style={{
                                fontSize: '14px',
                                color: theme.palette.info.main,
                                marginLeft: '8px',
                              }}
                            />
                          </CustomWidthTooltip>
                        </Box>
                      )}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      {row?.fee}
                    </StyledTableCell>
                    <StyledTableCell style={{ width: 'auto' }} align="left">
                      <CustomWidthTooltip
                        placement="top"
                        title={new Date(row?.timestamp).toLocaleString()}
                      >
                        <Box>{epochToAgo(row?.timestamp)}</Box>
                      </CustomWidthTooltip>
                    </StyledTableCell>
                  </StyledTableRow>
                )
              )}
              {emptyRowsRewardshare > 0 && (
                <TableRow style={{ height: 53 * emptyRowsRewardshare }}>
                  <TableCell colSpan={7} />
                </TableRow>
              )}
            </TableBody>
            <TableFooter sx={{ width: '100%' }}>
              <TableRow>
                <TablePagination
                  labelRowsPerPage={t('core:rows_per_page', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                  rowsPerPageOptions={[5, 10, 25, { label: 'All', value: -1 }]}
                  colSpan={7}
                  count={rewardshareInfo.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  slotProps={{
                    select: {
                      inputProps: {
                        'aria-label': 'row per page',
                      },
                      native: true,
                    },
                  }}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  ActionsComponent={TablePaginationActions}
                />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      );
    } else {
      return (
        <Typography
          variant="h5"
          align="center"
          sx={{ color: 'white', fontWeight: 700 }}
        >
          {t('core:message.generic.no_transactions', {
            postProcess: 'capitalizeFirstChar',
            transaction_type: 'REWARDSHARE',
          })}
        </Typography>
      );
    }
  };

  const tableAll = () => {
    if (allInfo && allInfo.length > 0) {
      return (
        <>
          <TableContainer component={Paper}>
            <Table stickyHeader sx={{ width: '100%' }} aria-label="all-table">
              <TableHead>
                <TableRow>
                  <StyledTableCell align="center">
                    {t('core:status', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:type', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:creator', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="center">
                    {t('core:identifier', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="center">
                    {t('core:size', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:recipient', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:amount', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:info', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:poll_name', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:fee.fee', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {t('core:time', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(rowsPerPage > 0
                  ? allInfo.slice(
                      page * rowsPerPage,
                      page * rowsPerPage + rowsPerPage
                    )
                  : allInfo
                ).map(
                  (
                    row: {
                      amount: number;
                      blockHeight: number;
                      creatorAddress: string;
                      fee: number;
                      identifier: string;
                      name: string;
                      newName: string;
                      pollName: string;
                      recipient: string;
                      rewardSharePublicKey: string;
                      seller: string;
                      sharePercent: string;
                      size: number;
                      timestamp: number;
                      type: string;
                    },
                    h: Key
                  ) => (
                    <StyledTableRow key={h}>
                      <StyledTableCell style={{ width: 'auto' }} align="center">
                        {(() => {
                          let confirmations: number =
                            nodeInfo?.height - row?.blockHeight;
                          if (confirmations < 3) {
                            return (
                              <Tooltip
                                placement="top"
                                title={t(
                                  'core:message.generic.confirmations_third',
                                  {
                                    postProcess: 'capitalizeFirstChar',
                                    count: confirmations,
                                  }
                                )}
                              >
                                <HistoryToggleOff
                                  style={{
                                    fontSize: '15px',
                                    color: theme.palette.error.main,
                                    marginTop: '2px',
                                  }}
                                />
                              </Tooltip>
                            );
                          } else {
                            return (
                              <Tooltip
                                placement="top"
                                title={t('core:message.generic.confirmations', {
                                  postProcess: 'capitalizeFirstChar',
                                  count: confirmations,
                                })}
                              >
                                <CheckCircleOutline
                                  style={{
                                    fontSize: '15px',
                                    color: theme.palette.success.main,
                                    marginTop: '2px',
                                  }}
                                />
                              </Tooltip>
                            );
                          }
                        })()}
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        {row?.type}
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        <CustomWidthTooltip
                          placement="top"
                          title={row?.creatorAddress}
                        >
                          <Box>
                            {row?.creatorAddress === address ||
                            row?.creatorAddress === userName ? (
                              <Box style={{ color: theme.palette.info.main }}>
                                {cropString(row?.creatorAddress)}
                              </Box>
                            ) : (
                              cropString(row?.creatorAddress)
                            )}
                          </Box>
                        </CustomWidthTooltip>
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        <CustomWidthTooltip
                          placement="top"
                          title={row?.identifier}
                        >
                          <Box>
                            {row?.identifier
                              ? cropString(row?.identifier)
                              : EMPTY_STRING}
                          </Box>
                        </CustomWidthTooltip>
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="right">
                        {row?.size > 0
                          ? humanFileSize(row?.size, true, 2)
                          : EMPTY_STRING}
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        <CustomWidthTooltip
                          placement="top"
                          title={row?.recipient}
                        >
                          <Box>
                            {row?.recipient === address ||
                            row?.recipient === userName ? (
                              <Box style={{ color: theme.palette.info.main }}>
                                {cropString(row?.recipient)}
                              </Box>
                            ) : row?.recipient ? (
                              cropString(row?.recipient)
                            ) : (
                              EMPTY_STRING
                            )}
                          </Box>
                        </CustomWidthTooltip>
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        {row?.amount}
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        {(() => {
                          if (row?.type === 'REGISTER_NAME') {
                            return t('core:qortal.registered_name', {
                              name: row?.name,
                              postProcess: 'capitalizeFirstChar',
                            });
                          } else if (row?.type === 'UPDATE_NAME') {
                            return t('core:qortal.old_new_name', {
                              oldName: row?.name,
                              newName: row?.newName,
                              postProcess: 'capitalizeFirstChar',
                            });
                          } else if (row?.type === 'SELL_NAME') {
                            return t('core:qortal.name_to_sell', {
                              name: row?.name,
                              amount: row?.amount,
                              postProcess: 'capitalizeFirstChar',
                            });
                          } else if (row?.type === 'CANCEL_SELL_NAME') {
                            return t('core:qortal.cancelled_name_sale', {
                              name: row?.name,
                              postProcess: 'capitalizeFirstChar',
                            });
                          } else if (row?.type === 'BUY_NAME') {
                            return t('core:qortal.seller', {
                              seller: row?.seller,
                              amount: row?.amount,
                              postProcess: 'capitalizeFirstChar',
                            });
                          } else if (row?.type === 'REWARD_SHARE') {
                            {
                              row?.sharePercent &&
                              row?.sharePercent?.startsWith('-') ? (
                                <Box
                                  style={{
                                    color: theme.palette.error.main,
                                    display: 'flex',
                                    alignItems: 'center',
                                  }}
                                >
                                  {t('core:qortal.removed', {
                                    postProcess: 'capitalizeFirstChar',
                                  })}
                                  <CustomWidthTooltip
                                    placement="top"
                                    title={
                                      row?.recipient === row?.creatorAddress
                                        ? 'Minting Key: ' +
                                          row?.rewardSharePublicKey
                                        : EMPTY_STRING
                                    }
                                  >
                                    <InfoOutlined
                                      style={{
                                        fontSize: '14px',
                                        color: theme.palette.info.main,
                                        marginLeft: '8px',
                                      }}
                                    />
                                  </CustomWidthTooltip>
                                </Box>
                              ) : (
                                row?.sharePercent && (
                                  <Box
                                    style={{
                                      color: theme.palette.success.main,
                                      display: 'flex',
                                      alignItems: 'center',
                                    }}
                                  >
                                    {t('core:qortal.created', {
                                      postProcess: 'capitalizeFirstChar',
                                    })}
                                    <CustomWidthTooltip
                                      placement="top"
                                      title={
                                        row?.recipient === row?.creatorAddress
                                          ? 'Minting Key: ' +
                                            row?.rewardSharePublicKey
                                          : EMPTY_STRING
                                      }
                                    >
                                      <InfoOutlined
                                        style={{
                                          fontSize: '14px',
                                          color: theme.palette.info.main,
                                          marginLeft: '8px',
                                        }}
                                      />
                                    </CustomWidthTooltip>
                                  </Box>
                                )
                              );
                            }
                          }
                        })()}
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        {row?.pollName}
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        {row?.fee}
                      </StyledTableCell>
                      <StyledTableCell style={{ width: 'auto' }} align="left">
                        {row?.timestamp > 0 ? (
                          <CustomWidthTooltip
                            placement="top"
                            title={new Date(row?.timestamp).toLocaleString()}
                          >
                            <Box>{epochToAgo(row?.timestamp)}</Box>
                          </CustomWidthTooltip>
                        ) : (
                          EMPTY_STRING
                        )}
                      </StyledTableCell>
                    </StyledTableRow>
                  )
                )}
                {emptyRowsAll > 0 && (
                  <TableRow style={{ height: 53 * emptyRowsAll }}>
                    <TableCell colSpan={11} />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            labelRowsPerPage={t('core:rows_per_page', {
              postProcess: 'capitalizeFirstChar',
            })}
            rowsPerPageOptions={[5, 10, 25, { label: 'All', value: -1 }]}
            count={allInfo.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            ActionsComponent={TablePaginationActions}
          />
        </>
      );
    } else {
      return (
        <Typography
          variant="h5"
          align="center"
          sx={{ color: 'white', fontWeight: 700 }}
        >
          {t('core:message.generic.no_transactions', {
            postProcess: 'capitalizeFirstChar',
            transaction_type: 'ALL',
          })}
        </Typography>
      );
    }
  };

  const qortalTables = () => {
    return (
      <Box sx={{ width: '100%' }}>
        <TabContext value={value}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <TabList
              onChange={handleChange}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="Qortal Transactions"
            >
              <Tab
                label={<span style={{ fontSize: '14px' }}>ALL</span>}
                value="Nine"
              />
              <Tab
                label={<span style={{ fontSize: '14px' }}>PAYMENT</span>}
                value="One"
              />
              <Tab
                label={<span style={{ fontSize: '14px' }}>ARBITRARY</span>}
                value="Two"
              />
              <Tab
                label={<span style={{ fontSize: '14px' }}>AT</span>}
                value="Three"
              />
              <Tab
                label={<span style={{ fontSize: '14px' }}>GROUP</span>}
                value="Four"
              />
              <Tab
                label={<span style={{ fontSize: '14px' }}>NAME</span>}
                value="Five"
              />
              <Tab
                label={<span style={{ fontSize: '14px' }}>ASSET</span>}
                value="Six"
              />
              <Tab
                label={<span style={{ fontSize: '14px' }}>POLL</span>}
                value="Seven"
              />
              <Tab
                label={<span style={{ fontSize: '14px' }}>REWARDSHARE</span>}
                value="Eight"
              />
            </TabList>
          </Box>
          <TabPanel value="Nine">{tableAll()}</TabPanel>
          <TabPanel value="One">{tablePayment()}</TabPanel>
          <TabPanel value="Two">{tableArbitrary()}</TabPanel>
          <TabPanel value="Three">{tableAt()}</TabPanel>
          <TabPanel value="Four">{tableGroup()}</TabPanel>
          <TabPanel value="Five">{tableName()}</TabPanel>
          <TabPanel value="Six">{tableAsset()}</TabPanel>
          <TabPanel value="Seven">{tablePoll()}</TabPanel>
          <TabPanel value="Eight">{tableRewardshare()}</TabPanel>
        </TabContext>
      </Box>
    );
  };

  const tableLoader = () => {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Box
          style={{
            display: 'flex',
            justifyContent: 'center',
            width: '100%',
          }}
        >
          <CircularProgress />
        </Box>
        <Box
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: '20px',
            width: '100%',
          }}
        >
          <Typography
            variant="h5"
            sx={{ color: 'primary.main', fontStyle: 'italic', fontWeight: 700 }}
          >
            {t('core:message.generic.loading_transactions', {
              postProcess: 'capitalizeFirstChar',
            })}
          </Typography>
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <Dialog
        fullScreen
        open={openQortSend}
        onClose={handleCloseQortSend}
        slots={{ transition: Transition }}
      >
        <SubmitDialog fullWidth={true} maxWidth="xs" open={openTxQortSubmit}>
          <DialogContent>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <Box
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <CircularProgress color="success" size={64} />
              </Box>
              <Box
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  marginTop: '20px',
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    color: 'primary.main',
                    fontStyle: 'italic',
                    fontWeight: 700,
                  }}
                >
                  {t('core:message.generic.processing_transaction', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </Typography>
              </Box>
            </Box>
          </DialogContent>
        </SubmitDialog>
        <Snackbar
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          open={openSendQortSuccess}
          autoHideDuration={TIME_SECONDS_4}
          slots={{ transition: SlideTransition }}
          onClose={handleCloseSendQortSuccess}
        >
          <Alert
            onClose={handleCloseSendQortSuccess}
            severity="success"
            variant="filled"
            sx={{ width: '100%' }}
          >
            {t('core:message.generic.sent_transaction', {
              coin: Coin.QORT,
              postProcess: 'capitalizeAll',
            })}
          </Alert>
        </Snackbar>
        <Snackbar
          open={openSendQortError}
          autoHideDuration={TIME_SECONDS_4}
          onClose={handleCloseSendQortError}
        >
          <Alert
            onClose={handleCloseSendQortError}
            severity="error"
            variant="filled"
            sx={{ width: '100%' }}
          >
            {t('core:message.error.something_went_wrong', {
              postProcess: 'capitalizeAll',
            })}
          </Alert>
        </Snackbar>
        <AppBar sx={{ position: 'static' }}>
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              onClick={handleCloseQortSend}
              aria-label="close"
            >
              <Close />
            </IconButton>
            <Avatar
              sx={{ width: 28, height: 28 }}
              alt="QORT Logo"
              src={coinLogoQORT}
            />
            <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{
                flexGrow: 1,
                display: {
                  xs: 'none',
                  sm: 'block',
                  paddingLeft: '10px',
                  paddingTop: '3px',
                },
              }}
            >
              {t('core:action.transfer_coin', {
                coin: Coin.QORT,
                postProcess: 'capitalizeFirstChar',
              })}
            </Typography>
            <Button
              disabled={sendDisabled}
              variant="contained"
              startIcon={<Send />}
              aria-label="send-qort"
              onClick={sendQortRequest}
              sx={{
                backgroundcolor: theme.palette.info.main,
                color: 'white',
                '&:hover': { backgroundcolor: 'action.hover' },
              }}
            >
              {t('core:action.send', {
                postProcess: 'capitalizeAll',
              })}
            </Button>
          </Toolbar>
        </AppBar>
        <Box
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '20px',
          }}
        >
          <Typography
            variant="h5"
            align="center"
            gutterBottom
            sx={{ color: 'primary.main', fontWeight: 700 }}
          >
            {t('core:balance_available', {
              postProcess: 'capitalizeFirstChar',
            })}
            &nbsp;&nbsp;
          </Typography>
          <Typography
            variant="h5"
            align="center"
            gutterBottom
            sx={{ color: 'text.primary', fontWeight: 700 }}
          >
            {isLoadingWalletBalanceQort ? (
              <Box sx={{ width: '175px' }}>
                <LinearProgress />
              </Box>
            ) : (
              walletBalanceQort + ' QORT'
            )}
          </Typography>
        </Box>
        <Box
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '20px',
          }}
        >
          <Typography
            variant="h5"
            align="center"
            sx={{ color: 'primary.main', fontWeight: 700 }}
          >
            {t('core:max_sendable', {
              postProcess: 'capitalizeFirstChar',
            })}
            &nbsp;&nbsp;
          </Typography>
          <Typography
            variant="h5"
            align="center"
            sx={{ color: 'text.primary', fontWeight: 700 }}
          >
            {(walletBalanceQort - qortTxFee).toFixed(DECIMAL_ROUND_UP) + ' QORT'}
          </Typography>
          <Box style={{ marginInlineStart: '15px' }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleSendMaxQort}
              style={{ borderRadius: 50 }}
            >
              {t('core:action.send_max', {
                postProcess: 'capitalizeAll',
              })}
            </Button>
          </Box>
        </Box>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            justifyContent: 'center',
            gap: 2,
            mt: 2.5,
            mx: 'auto',
            width: '100%',
            maxWidth: 420,
            px: { xs: 0, sm: 1 },
          }}
        >
          <NumericFormat
            decimalScale={8}
            defaultValue={0}
            value={qortAmount ?? EMPTY_STRING}
            allowNegative={false}
            customInput={TextField}
            valueIsNumericString
            variant="outlined"
            label={
              t('core:amount', { postProcess: 'capitalizeAll' }) + '(QORT)'
            }
            fullWidth
            isAllowed={(values) => {
              const max = maxSendableQortCoin();
              const { formattedValue, floatValue } = values;
              return (
                formattedValue === EMPTY_STRING || (floatValue ?? 0) <= max
              );
            }}
            onValueChange={onAmountChange}
            onBlur={onAmountBlur}
            required
            helperText={
              amountTouched ? amountError || EMPTY_STRING : EMPTY_STRING
            } // show only when touched
            error={amountTouched && !!amountError}
          />

          <TextField
            required
            label={t('core:receiver_address_name', {
              postProcess: 'capitalizeFirstChar',
            })}
            id="qort-address"
            margin="normal"
            value={qortRecipient}
            onChange={(e) => {
              setQortRecipient(e.target.value.trim());
              setRecipientTouched(true);
            }}
            onBlur={onRecipientBlur}
            slotProps={{ htmlInput: { maxLength: 34, minLength: 3 } }}
            fullWidth
            helperText={
              recipientTouched
                ? addressValidating
                  ? t('core:message.generic.validating', {
                      postProcess: 'capitalizeFirstChar',
                    })
                  : recipientError || EMPTY_STRING
                : t('core:message.generic.qortal_address', {
                    postProcess: 'capitalizeFirstChar',
                  })
            }
            error={recipientTouched && !!recipientError}
          />
        </Box>
        <Box
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography
            align="center"
            sx={{ fontWeight: 600, fontSize: '14px', marginTop: '15px' }}
          >
            {t('core:message.generic.sending_fee', {
              quantity: 0.01,
              coin: Coin.QORT,
              postProcess: 'capitalizeFirstChar',
            })}
          </Typography>
        </Box>
      </Dialog>

      <AddressBookDialog
        open={openQortAddressBook}
        onClose={handleCloseAddressBook}
        coinType={Coin.QORT}
        onSelectAddress={handleSelectAddress}
        prefillData={addressBookPrefill}
      />

      <WalletCard sx={{ p: { xs: 2, md: 3 }, width: '100%' }}>
        <Grid container rowSpacing={{ xs: 2, md: 3 }} columnSpacing={2}>
          <Grid
            container
            alignItems="center"
            columnSpacing={4}
            rowSpacing={{ xs: 12, md: 0 }}
          >
            <Grid
              container
              size={12}
              justifyContent="space-around"
              alignItems="center"
              sx={{
                flexDirection: { xs: 'column', md: 'row' },
                textAlign: { xs: 'center', md: 'left' },
                gap: { xs: 3, md: 0 },
              }}
            >
              <Box
                sx={{
                  display: 'grid',
                  alignItems: 'center',
                  justifyItems: { xs: 'center', md: 'start' },
                  gap: 1,
                }}
              >
                <Box
                  component="img"
                  alt="QORT Logo"
                  src={coinLogoQORT}
                  sx={{
                    width: { xs: 96, sm: 110, md: 120 },
                    height: { xs: 96, sm: 110, md: 120 },
                    mr: { md: 1 },
                  }}
                />
                <Typography
                  variant="subtitle2"
                  sx={{ color: 'text.secondary' }}
                >
                  {t('core:message.generic.qortal_wallet', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </Typography>
              </Box>

              <Grid
                sx={{
                  display: 'grid',
                  gap: { xs: 2, md: 1 },
                  gridTemplateColumns: {
                    xs: '1fr',
                    md: 'minmax(0, 1fr) minmax(0, 0.6fr)',
                  },
                  gridTemplateRows: { xs: 'repeat(3, auto)', md: '1fr 1fr' },
                }}
              >
                <Grid
                  sx={{
                    gridColumn: { xs: '1', md: '1' },
                    gridRow: { xs: '1', md: '1' },
                    p: { xs: 1.5, md: 2 },
                  }}
                  display={'flex'}
                  alignItems={'center'}
                  gap={1}
                >
                  <Typography
                    variant="h5"
                    sx={{ color: 'primary.main', fontWeight: 700 }}
                  >
                    {t('core:balance', {
                      postProcess: 'capitalizeFirstChar',
                    })}
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {isLoadingWalletBalanceQort ? (
                      <LinearProgress />
                    ) : (
                      `${walletBalanceQort} QORT`
                    )}
                  </Typography>
                </Grid>

                <Grid
                  sx={{
                    gridColumn: { xs: '1', md: '1' },
                    gridRow: { xs: '2', md: '2' },
                    p: { xs: 1.5, md: 2 },
                  }}
                >
                  <Box alignItems={'center'} display={'flex'} gap={1}>
                    <Typography
                      variant="subtitle1"
                      sx={{ color: 'primary.main', fontWeight: 700 }}
                    >
                      {t('core:address', {
                        postProcess: 'capitalizeFirstChar',
                      })}
                    </Typography>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        color: 'text.primary',
                        fontWeight: 700,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        width: {
                          xs: '100%',
                          sm: '220px',
                          md: '200px',
                          lg: '370px',
                        },
                      }}
                    >
                      {address}
                    </Typography>
                    <CustomWidthTooltip
                      placement="top"
                      title={t('core:action.copy_address', {
                        postProcess: 'capitalizeFirstChar',
                      })}
                    >
                      <IconButton
                        size="small"
                        onClick={() => copyToClipboard(address ?? EMPTY_STRING)}
                      >
                        <CopyAllTwoTone fontSize="small" />
                      </IconButton>
                    </CustomWidthTooltip>
                  </Box>
                </Grid>

                <Grid
                  alignContent={'center'}
                  display={'flex'}
                  justifyContent={'center'}
                  sx={{
                    gridColumn: { xs: '1', md: '2' },
                    gridRow: { xs: '3', md: '1 / span 2' },
                    p: { xs: 1.5, md: 2 },
                  }}
                >
                  <Box
                    sx={{
                      alignItems: 'center',
                      aspectRatio: '1 / 1',
                      bgcolor: '#fff',
                      border: (t) => `1px solid ${t.palette.divider}`,
                      borderRadius: 1,
                      boxShadow: (t) => t.shadows[2],
                      display: 'flex',
                      justifyContent: 'center',
                      height: '100%',
                      maxHeight: { xs: 200, md: 150 },
                      maxWidth: { xs: 200, md: 150 },
                      p: 0.5,
                    }}
                  >
                    <QRCode
                      value={address ?? EMPTY_STRING}
                      size={200}
                      fgColor="#000000"
                      bgColor="#ffffff"
                      level="H"
                      style={{ width: '100%', height: '100%' }}
                    />
                  </Box>
                </Grid>
              </Grid>
            </Grid>

            <Grid size={12}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 3,
                  mt: { xs: 1, md: 2 },
                  flexWrap: 'wrap',
                }}
              >
                <WalletButtons
                  variant="contained"
                  startIcon={<Send style={{ marginBottom: 2 }} />}
                  aria-label="Transfer"
                  onClick={handleOpenQortSend}
                >
                  {t('core:action.transfer_coin', {
                    coin: Coin.QORT,
                    postProcess: 'capitalizeFirstChar',
                  })}
                </WalletButtons>

                <WalletButtons
                  variant="contained"
                  startIcon={<ImportContacts style={{ marginBottom: 2 }} />}
                  aria-label="AddressBook"
                  onClick={handleOpenAddressBook}
                >
                  {t('core:address_book', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </WalletButtons>
              </Box>
            </Grid>
          </Grid>

          <Grid size={12}>
            <Box sx={{ width: '100%', mt: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                <Button
                  size="large"
                  onClick={handleLoadingRefreshQort}
                  loading={loadingRefreshQort}
                  loadingPosition="start"
                  startIcon={<Refresh style={{ marginBottom: 2 }} />}
                  variant="text"
                  sx={{ borderRadius: 50 }}
                >
                  <span>
                    {t('core:transactions', { postProcess: 'capitalizeAll' })}
                  </span>
                </Button>
              </Box>

              {loadingRefreshQort ? (
                <Box sx={{ width: '100%' }}>{tableLoader()}</Box>
              ) : (
                <Box sx={{ width: '100%' }}>{qortalTables()}</Box>
              )}
            </Box>
          </Grid>
        </Grid>
      </WalletCard>
    </Box>
  );
}
