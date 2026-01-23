import WalletContext from '../../contexts/walletContext';
import {
  copyToClipboard,
  cropString,
  epochToAgo,
  timeoutDelay,
} from '../../common/functions';
import { AddressBookDialog } from '../../components/AddressBook/AddressBookDialog';
import { useTheme } from '@mui/material/styles';
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import { NumericFormat } from 'react-number-format';
import Snackbar, { SnackbarCloseReason } from '@mui/material/Snackbar';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import QRCode from 'react-qr-code';
import {
  Close,
  CopyAllTwoTone,
  FirstPage,
  ImportContacts,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  LastPage,
  Send,
} from '@mui/icons-material';
import coinLogoARRR from '../../assets/arrr.png';
import {
  ChangeEvent,
  Key,
  MouseEvent,
  SyntheticEvent,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Refresh } from '@mui/icons-material';
import {
  ARRR_FEE,
  DECIMAL_ROUND_UP,
  EMPTY_STRING,
  TIME_MINUTES_2,
  TIME_MINUTES_3,
  TIME_MINUTES_5,
  TIME_SECONDS_2,
  TIME_SECONDS_3,
  TIME_SECONDS_4,
  TIME_SECONDS_5,
} from '../../common/constants';
import {
  CustomWidthTooltip,
  LightwalletDialog,
  SlideTransition,
  StyledTableCell,
  StyledTableRow,
  SubmitDialog,
  Transition,
  WalletButtons,
  WalletCard,
} from '../../styles/page-styles';
import { Coin } from 'qapp-core';
import { validateArrrAddress } from '../../utils/addressValidation';

interface TablePaginationActionsProps {
  count: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (event: MouseEvent<HTMLButtonElement>, newPage: number) => void;
}

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

export default function PirateWallet() {
  const { t } = useTranslation(['core']);
  const theme = useTheme();
  const { isUsingGateway } = useContext(WalletContext);
  const [isSynced, setIsSynced] = useState(false);
  const [syncStatus, setSyncStatus] = useState(EMPTY_STRING);
  const [walletInfoArrr, setWalletInfoArrr] = useState<any>({});
  const [walletBalanceArrr, setWalletBalanceArrr] = useState<any>(0);
  const [_isLoadingWalletInfoArrr, setIsLoadingWalletInfoArrr] =
    useState<boolean>(true);
  const [isLoadingWalletBalanceArrr, setIsLoadingWalletBalanceArrr] =
    useState<boolean>(true);
  const [allLightwalletServersArrr, setAllLightwalletServersArrr] =
    useState<any>([]);
  const [currentLightwalletServerArrr, setCurrentLightwalletServerArrr] =
    useState<any>([]);
  const [_changeServer, setChangeServer] = useState(false);
  const [arrrMemo, setArrrMemo] = useState(EMPTY_STRING);
  const [transactionsArrr, setTransactionsArrr] = useState<any>([]);
  const [isLoadingArrrTransactions, setIsLoadingArrrTransactions] =
    useState<boolean>(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [copyArrrTxHash, setCopyArrrTxHash] = useState(EMPTY_STRING);
  const [openArrrLightwallet, setOpenArrrLightwallet] = useState(false);
  const [openArrrServerChange, setOpenArrrServerChange] = useState(false);
  const [openArrrSend, setOpenArrrSend] = useState(false);
  const [arrrAmount, setArrrAmount] = useState<number>(0);
  const [arrrRecipient, setArrrRecipient] = useState(EMPTY_STRING);
  const [addressFormatError, setAddressFormatError] = useState(false);
  const [loadingRefreshArrr, setLoadingRefreshArrr] = useState(false);
  const [openTxArrrSubmit, setOpenTxArrrSubmit] = useState(false);
  const [openSendArrrSuccess, setOpenSendArrrSuccess] = useState(false);
  const [openSendArrrError, setOpenSendArrrError] = useState(false);
  const [openArrrAddressBook, setOpenArrrAddressBook] = useState(false);
  const [_retry, setRetry] = useState(false);

  const maxSendableArrrCoin = () => {
    // manage the correct round up
    const value = (walletBalanceArrr - ARRR_FEE).toString();
    const [integer, decimal = ''] = value.split('.');
    const truncated = decimal
      .substring(0, DECIMAL_ROUND_UP)
      .padEnd(DECIMAL_ROUND_UP, '0');
    let truncatedMaxSendableArrrCoin: number = parseFloat(
      `${integer}.${truncated}`
    );
    return truncatedMaxSendableArrrCoin;
  };

  const emptyRows =
    page > 0
      ? Math.max(0, (1 + page) * rowsPerPage - transactionsArrr.length)
      : 0;

  const handleCloseArrrLightwallet = () => {
    setOpenArrrLightwallet(false);
  };

  const handleCloseArrrServerChange = () => {
    setOpenArrrServerChange(false);
  };

  const handleOpenAddressBook = () => {
    setOpenArrrAddressBook(true);
  };

  const handleCloseAddressBook = () => {
    setOpenArrrAddressBook(false);
  };

  const handleSelectAddress = (address: string, _name: string) => {
    setArrrRecipient(address);
    setArrrAmount(0);
    setArrrMemo(EMPTY_STRING);
    setOpenArrrAddressBook(false);
    setOpenArrrSend(true);
    setAddressFormatError(false);
    setOpenSendArrrError(false);
  };

  const handleOpenArrrSend = () => {
    setArrrAmount(0);
    setArrrRecipient(EMPTY_STRING);
    setArrrMemo(EMPTY_STRING);
    setOpenArrrSend(true);
    setAddressFormatError(false);
    setOpenSendArrrError(false);
  };

  const disableCanSendArrr = () =>
    arrrAmount <= 0 || arrrRecipient === EMPTY_STRING || addressFormatError;

  const handleRecipientChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    setArrrRecipient(value);
    
    if (validateArrrAddress(value) || value === EMPTY_STRING) {
      setAddressFormatError(false);
    } else {
      setAddressFormatError(true);
    }
  };

  const handleCloseArrrSend = () => {
    setArrrAmount(0);
    setArrrRecipient(EMPTY_STRING);
    setArrrMemo(EMPTY_STRING);
    setOpenArrrSend(false);
    setAddressFormatError(false);
    setOpenSendArrrError(false);
  };

  const changeCopyArrrTxHash = async () => {
    setCopyArrrTxHash('Copied');
    await timeoutDelay(TIME_SECONDS_2);
    setCopyArrrTxHash(EMPTY_STRING);
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

  const handleSendMaxArrr = () => {
    if (maxSendableArrrCoin() <= 0) {
      setArrrAmount(0);
    } else {
      setArrrAmount(maxSendableArrrCoin());
    }
  };

  const handleCloseSendArrrSuccess = (
    _event?: SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSendArrrSuccess(false);
  };

  const handleCloseSendArrrError = (
    _event?: SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSendArrrError(false);
  };

  const sendArrrRequest = async () => {
    setOpenTxArrrSubmit(true);
    try {
      const sendRequest = await qortalRequest({
        action: 'SEND_COIN',
        coin: Coin.ARRR,
        recipient: arrrRecipient,
        amount: arrrAmount,
        memo: arrrMemo,
      });
      if (!sendRequest?.error) {
        setArrrAmount(0);
        setArrrRecipient(EMPTY_STRING);
        setArrrMemo(EMPTY_STRING);
        setOpenTxArrrSubmit(false);
        setOpenSendArrrSuccess(true);
        setIsLoadingWalletBalanceArrr(true);
        await timeoutDelay(TIME_SECONDS_3);
        getWalletBalanceArrr();
      }
    } catch (error) {
      setArrrAmount(0);
      setArrrRecipient(EMPTY_STRING);
      setArrrMemo(EMPTY_STRING);
      setOpenTxArrrSubmit(false);
      setOpenSendArrrError(true);
      setIsLoadingWalletBalanceArrr(true);
      await timeoutDelay(TIME_SECONDS_3);
      getWalletBalanceArrr();
      console.error('ERROR SENDING ARRR', error);
    }
  };

  const getWalletInfoArrr = async () => {
    setIsLoadingWalletInfoArrr(true);
    try {
      const response = await qortalRequest({
        action: 'GET_USER_WALLET',
        coin: Coin.ARRR,
      });
      if (!response?.error) {
        setWalletInfoArrr(response);
      }
    } catch (error) {
      setWalletInfoArrr({});
      console.error('ERROR GET ARRR WALLET INFO', error);
    } finally {
      setIsLoadingWalletInfoArrr(false);
    }
  };

  const getWalletBalanceArrr = async () => {
    try {
      setIsLoadingWalletBalanceArrr(true);

      const response = await qortalRequestWithTimeout(
        {
          action: 'GET_WALLET_BALANCE',
          coin: Coin.ARRR,
        },
        TIME_MINUTES_2
      );
      if (!response?.error) {
        setWalletBalanceArrr(response);
      }
    } catch (error: any) {
      setWalletBalanceArrr(null);
      console.error('ERROR GET ARRR BALANCE', error);
    } finally {
      setIsLoadingWalletBalanceArrr(false);
    }
  };

  const getUpdatedWalletBalance = () => {
    const intervalGetWalletBalanceArrr = setInterval(() => {
      getWalletBalanceArrr();
    }, TIME_MINUTES_3);
    getWalletBalanceArrr();
    return () => {
      clearInterval(intervalGetWalletBalanceArrr);
    };
  };

  const getLightwalletServersArrr = async () => {
    try {
      const response = await qortalRequest({
        action: 'GET_CROSSCHAIN_SERVER_INFO',
        coin: Coin.ARRR,
      });
      if (!response?.error) {
        setAllLightwalletServersArrr(response);
        let currentArrrServer = response.filter(function (item: {
          isCurrent: boolean;
        }) {
          return item.isCurrent == true;
        });
        setCurrentLightwalletServerArrr(currentArrrServer);
      }
    } catch (error) {
      setAllLightwalletServersArrr({});
      console.error('ERROR GET ARRR SERVERS INFO', error);
    }
  };

  const getTransactionsArrr = async () => {
    try {
      setIsLoadingArrrTransactions(true);
      const response = await qortalRequestWithTimeout(
        {
          action: 'GET_USER_WALLET_TRANSACTIONS',
          coin: Coin.ARRR,
        },
        TIME_MINUTES_5
      );
      if (!response?.error) {
        const compareFn = (
          a: { timestamp: number },
          b: { timestamp: number }
        ) => {
          return b.timestamp - a.timestamp;
        };
        const sortedArrrTransactions = response.sort(compareFn);
        setTransactionsArrr(sortedArrrTransactions);
        setIsLoadingArrrTransactions(false);
      }
    } catch (error) {
      setIsLoadingArrrTransactions(false);
      setTransactionsArrr([]);
      console.error('ERROR GET ARRR TRANSACTIONS', error);
    }
  };

  const getArrrSyncStatus = async () => {
    try {
      let counter = 0;
      let counter2 = 0;
      while (!isSynced && counter < 36 && counter2 < 60) {
        const response = await qortalRequest({
          action: 'GET_ARRR_SYNC_STATUS',
        });
        if (!response?.error) {
          if (
            response.indexOf('<') > -1 ||
            response !== 'Synchronized' ||
            response === 'Not initialized yet'
          ) {
            if (response.indexOf('<') > -1) {
              setSyncStatus(
                t('core:message.error.pirate_chain_no_server', {
                  postProcess: 'capitalizeAll',
                })
              );
              setChangeServer(false);
              setIsSynced(false);
              counter = 37;
            } else if (response === 'Not initialized yet') {
              setChangeServer(false);
              setSyncStatus(
                t('core:message.generic.not_initialized_yet', {
                  postProcess: 'capitalizeAll',
                })
              );
              setIsSynced(false);
              counter += 1;
              await new Promise((resolve) =>
                setTimeout(resolve, TIME_SECONDS_5)
              );
            } else if (response === 'Initializing wallet...') {
              setChangeServer(false);
              setSyncStatus(
                t('core:message.generic.initializing_wallet', {
                  postProcess: 'capitalizeAll',
                })
              );
              setIsSynced(false);
              counter2 += 1;
              await new Promise((resolve) =>
                setTimeout(resolve, TIME_SECONDS_5)
              );
            } else {
              setChangeServer(false);
              setSyncStatus(response);
              setIsSynced(false);
              await new Promise((resolve) =>
                setTimeout(resolve, TIME_SECONDS_5)
              );
            }
          } else {
            setIsSynced(true);
            setSyncStatus(EMPTY_STRING);
            setChangeServer(false);
            getWalletInfoArrr();
            await new Promise((resolve) => setTimeout(resolve, TIME_SECONDS_3));
            getUpdatedWalletBalance();
            await new Promise((resolve) => setTimeout(resolve, TIME_SECONDS_3));
            getLightwalletServersArrr();
            await new Promise((resolve) => setTimeout(resolve, TIME_SECONDS_3));
            getTransactionsArrr();
            return;
          }
        }
      }
      setIsSynced(false);
      setSyncStatus(
        t('core:message.error.pirate_chain_no_server', {
          postProcess: 'capitalizeAll',
        })
      );
      setChangeServer(true);
      return;
    } catch (error) {
      setSyncStatus(String(error));
      setIsSynced(false);
      setRetry(true);
      console.error('ERROR GET ARRR SYNC STATUS', error);
    }
  };

  const handleOpenArrrServerChange = async () => {
    await getLightwalletServersArrr();
    setOpenArrrServerChange(true);
  };

  const handleRetry = async () => {
    setRetry(false);
    await getArrrSyncStatus();
  };

  const handleLoadingRefreshArrr = async () => {
    setLoadingRefreshArrr(true);
    await getTransactionsArrr();
    setLoadingRefreshArrr(false);
  };

  useEffect(() => {
    getArrrSyncStatus();
  }, []);

  if (isUsingGateway) {
    return (
      <Alert variant="filled" severity="error">
        {t('core:message.error.pirate_chain_gateway', {
          postProcess: 'capitalizeEachFirst',
        })}
      </Alert>
    );
  }

  const setNewCurrentArrrServer = async (
    typeServer: string,
    hostServer: string,
    portServer: number
  ) => {
    try {
      const setServer = await qortalRequest({
        action: 'SET_CURRENT_FOREIGN_SERVER',
        coin: Coin.ARRR,
        type: typeServer,
        host: hostServer,
        port: portServer,
      });
      if (!setServer?.error) {
        setOpenArrrLightwallet(false);
        await getLightwalletServersArrr();
        await getWalletBalanceArrr();
        await getTransactionsArrr();
      }
    } catch (error) {
      await getLightwalletServersArrr();
      setOpenArrrLightwallet(false);
      console.error('ERROR GET ARRR SERVERS INFO', error);
    }
  };

  const setNewArrrServer = async (
    typeServer: string,
    hostServer: string,
    portServer: number
  ) => {
    try {
      const setServer = await qortalRequest({
        action: 'SET_CURRENT_FOREIGN_SERVER',
        coin: Coin.ARRR,
        type: typeServer,
        host: hostServer,
        port: portServer,
      });
      if (!setServer?.error) {
        setOpenArrrServerChange(false);
        await getLightwalletServersArrr();
        await getArrrSyncStatus();
      }
    } catch (error) {
      setOpenArrrServerChange(false);
      await getLightwalletServersArrr();
      await getArrrSyncStatus();
      console.error('ERROR GET ARRR SERVERS INFO', error);
    }
  };

  const ArrrTableLoader = () => {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Box
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <CircularProgress />
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

  const ArrrTransactionsTable = () => {
    return (
      <TableContainer component={Paper}>
        <Table
          stickyHeader
          sx={{ width: '100%' }}
          aria-label="transactions table"
        >
          <TableHead>
            <TableRow>
              <StyledTableCell align="left">
                {t('core:sender', {
                  postProcess: 'capitalizeFirstChar',
                })}
              </StyledTableCell>
              <StyledTableCell align="left">
                {t('core:receiver', {
                  postProcess: 'capitalizeFirstChar',
                })}
              </StyledTableCell>
              <StyledTableCell align="left">
                {t('core:transaction_hash', {
                  postProcess: 'capitalizeFirstChar',
                })}
              </StyledTableCell>
              <StyledTableCell align="left">
                {t('core:memo', {
                  postProcess: 'capitalizeFirstChar',
                })}
              </StyledTableCell>
              <StyledTableCell align="left">
                {t('core:total_amount', {
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
              ? transactionsArrr.slice(
                  page * rowsPerPage,
                  page * rowsPerPage + rowsPerPage
                )
              : transactionsArrr
            ).map(
              (
                row: {
                  inputs: {
                    address: any;
                    addressInWallet: boolean;
                    amount: number;
                  }[];
                  outputs: {
                    address: any;
                    addressInWallet: boolean;
                    amount: number;
                  }[];
                  txHash: string;
                  totalAmount: any;
                  feeAmount: any;
                  memo: string;
                  timestamp: number;
                },
                k: Key
              ) => (
                <StyledTableRow key={k}>
                  <StyledTableCell style={{ width: 'auto' }} align="left">
                    {row.inputs.map((input, index) => (
                      <Box
                        key={index}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          color: input.addressInWallet
                            ? undefined
                            : theme.palette.info.main,
                        }}
                      >
                        <span style={{ flex: 1, textAlign: 'left' }}>
                          {cropString(input.address)}
                        </span>
                        <span style={{ flex: 1, textAlign: 'right' }}>
                          {(Number(input.amount) / 1e8).toFixed(
                            DECIMAL_ROUND_UP
                          )}
                        </span>
                      </Box>
                    ))}
                  </StyledTableCell>
                  <StyledTableCell style={{ width: 'auto' }} align="left">
                    {row.outputs.map((output, index) => (
                      <Box
                        key={index}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          color: output.addressInWallet
                            ? undefined
                            : theme.palette.info.main,
                        }}
                      >
                        <span style={{ flex: 1, textAlign: 'left' }}>
                          {cropString(output.address)}
                        </span>
                        <span style={{ flex: 1, textAlign: 'right' }}>
                          {(Number(output.amount) / 1e8).toFixed(
                            DECIMAL_ROUND_UP
                          )}
                        </span>
                      </Box>
                    ))}
                  </StyledTableCell>
                  <StyledTableCell style={{ width: 'auto' }} align="left">
                    {cropString(row?.txHash)}
                    <CustomWidthTooltip
                      placement="top"
                      title={
                        copyArrrTxHash
                          ? copyArrrTxHash
                          : t('core:action.copy_hash', {
                              hash: row?.txHash,
                              postProcess: 'capitalizeFirstChar',
                            })
                      }
                    >
                      <IconButton
                        aria-label="copy"
                        size="small"
                        onClick={() => {
                          copyToClipboard(row?.txHash);
                          changeCopyArrrTxHash();
                        }}
                      >
                        <CopyAllTwoTone fontSize="small" />
                      </IconButton>
                    </CustomWidthTooltip>
                  </StyledTableCell>
                  <StyledTableCell style={{ width: 'auto' }} align="left">
                    {row?.memo ? row?.memo : EMPTY_STRING}
                  </StyledTableCell>
                  <StyledTableCell style={{ width: 'auto' }} align="left">
                    {row?.totalAmount > 0 ? (
                      <Box style={{ color: theme.palette.success.main }}>
                        +
                        {(Number(row?.totalAmount) / 1e8).toFixed(
                          DECIMAL_ROUND_UP
                        )}
                      </Box>
                    ) : (
                      <Box style={{ color: theme.palette.error.main }}>
                        {(Number(row?.totalAmount) / 1e8).toFixed(
                          DECIMAL_ROUND_UP
                        )}
                      </Box>
                    )}
                  </StyledTableCell>
                  <StyledTableCell style={{ width: 'auto' }} align="right">
                    {row?.totalAmount <= 0 ? (
                      <Box style={{ color: theme.palette.error.main }}>
                        -
                        {(Number(row?.feeAmount) / 1e8).toFixed(
                          DECIMAL_ROUND_UP
                        )}
                      </Box>
                    ) : (
                      <Box></Box>
                    )}
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
            {emptyRows > 0 && (
              <TableRow style={{ height: 53 * emptyRows }}>
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
                count={transactionsArrr.length}
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
  };

  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <AddressBookDialog
        open={openArrrAddressBook}
        onClose={handleCloseAddressBook}
        coinType={Coin.ARRR}
        onSelectAddress={handleSelectAddress}
      />

      <LightwalletDialog
        onClose={handleCloseArrrLightwallet}
        aria-labelledby="arrr-electrum-servers"
        open={openArrrLightwallet}
        keepMounted={false}
      >
        <DialogTitle
          sx={{ m: 0, p: 2, fontSize: '14px' }}
          id="arrr-electrum-servers"
        >
          {t('core:message.generic.pirate_chain_servers', {
            postProcess: 'capitalizeFirstChar',
          })}
        </DialogTitle>
        <DialogContent dividers>
          <Box
            sx={{
              width: '100%',
              maxWidth: 500,
              position: 'relative',
              overflow: 'auto',
              maxHeight: 400,
            }}
          >
            <List>
              {allLightwalletServersArrr.map(
                (
                  server: {
                    connectionType: string;
                    hostName: string;
                    port: number;
                  },
                  i: Key
                ) => (
                  <ListItemButton
                    key={i}
                    onClick={() => {
                      setNewCurrentArrrServer(
                        server?.connectionType,
                        server?.hostName,
                        server?.port
                      );
                    }}
                  >
                    <ListItemText
                      primary={
                        server?.connectionType +
                        '://' +
                        server?.hostName +
                        ':' +
                        server?.port
                      }
                      key={i}
                    />
                  </ListItemButton>
                )
              )}
            </List>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={handleCloseArrrLightwallet}>
            {t('core:action.close', {
              postProcess: 'capitalizeFirstChar',
            })}
          </Button>
        </DialogActions>
      </LightwalletDialog>

      <Dialog
        fullScreen
        open={openArrrSend}
        onClose={handleCloseArrrSend}
        slots={{ transition: Transition }}
      >
        <SubmitDialog fullWidth={true} maxWidth="xs" open={openTxArrrSubmit}>
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
          open={openSendArrrSuccess}
          autoHideDuration={TIME_SECONDS_4}
          slots={{ transition: SlideTransition }}
          onClose={handleCloseSendArrrSuccess}
        >
          <Alert
            onClose={handleCloseSendArrrSuccess}
            severity="success"
            variant="filled"
            sx={{ width: '100%' }}
          >
            {t('core:message.generic.sent_transaction', {
              coin: Coin.ARRR,
              postProcess: 'capitalizeAll',
            })}
          </Alert>
        </Snackbar>
        <Snackbar
          open={openSendArrrError}
          autoHideDuration={TIME_SECONDS_4}
          onClose={handleCloseSendArrrError}
        >
          <Alert
            onClose={handleCloseSendArrrError}
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
              onClick={handleCloseArrrSend}
              aria-label="close"
            >
              <Close />
            </IconButton>
            <Avatar
              sx={{ width: 28, height: 28 }}
              alt="ARRR Logo"
              src={coinLogoARRR}
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
                coin: Coin.ARRR,
                postProcess: 'capitalizeAll',
              })}
            </Typography>
            <Button
              disabled={disableCanSendArrr()}
              variant="contained"
              startIcon={<Send />}
              aria-label="send-arrr"
              onClick={sendArrrRequest}
              sx={{
                backgroundcolor: 'action.main',
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
              postProcess: 'capitalizeAll',
            })}
            &nbsp;&nbsp;
          </Typography>
          <Typography
            variant="h5"
            align="center"
            gutterBottom
            sx={{ color: 'text.primary', fontWeight: 700 }}
          >
            {isLoadingWalletBalanceArrr ? (
              <Box sx={{ width: '175px' }}>
                <LinearProgress />
              </Box>
            ) : (
              walletBalanceArrr + ' ARRR'
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
            {(walletBalanceArrr - ARRR_FEE).toFixed(DECIMAL_ROUND_UP) + ' ARRR'}
          </Typography>
          <Box style={{ marginInlineStart: '15px' }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleSendMaxArrr}
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
            px: { xs: 2, sm: 1 },
          }}
        >
          <NumericFormat
            decimalScale={8}
            defaultValue={0}
            value={arrrAmount}
            allowNegative={false}
            customInput={TextField}
            valueIsNumericString
            {...({ label: 'Amount (ARRR)' } as any)}
            fullWidth
            isAllowed={(values) => {
              const maxArrrCoin = walletBalanceArrr - ARRR_FEE;
              const { formattedValue, floatValue } = values;
              return (
                formattedValue === EMPTY_STRING ||
                (floatValue !== undefined && floatValue <= maxArrrCoin)
              );
            }}
            onValueChange={(values) => {
              setArrrAmount(values.floatValue ?? 0);
            }}
            slotProps={{
              input: {
                variant: 'outlined',
              },
            }}
            required
          />
          <TextField
            required
            label={t('core:receiver_address', {
              postProcess: 'capitalizeFirstChar',
            })}
            id="arrr-address"
            margin="normal"
            value={arrrRecipient}
            onChange={handleRecipientChange}
            error={addressFormatError}
            fullWidth
            helperText={t('core:message.generic.pirate_chain_address', {
              postProcess: 'capitalizeFirstChar',
            })}
            slotProps={{ htmlInput: { maxLength: 78, minLength: 78 } }}
          />
          <TextField
            label={t('core:memo', {
              postProcess: 'capitalizeFirstChar',
            })}
            id="arrr-memo"
            margin="normal"
            value={arrrMemo}
            fullWidth
            helperText={t('core:message.generic.pirate_chain_max_chars', {
              postProcess: 'capitalizeFirstChar',
            })}
            slotProps={{ htmlInput: { maxLength: 40, minLength: 40 } }}
            onChange={(e: any) => setArrrMemo(e.target.value)}
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
              quantity: ARRR_FEE,
              coin: Coin.ARRR,
              postProcess: 'capitalizeFirstChar',
            })}
          </Typography>
        </Box>
      </Dialog>

      <LightwalletDialog
        onClose={handleCloseArrrServerChange}
        aria-labelledby="arrr-electrum-servers"
        open={openArrrServerChange}
        keepMounted={false}
      >
        <DialogTitle
          sx={{ m: 0, p: 2, fontSize: '14px' }}
          id="arrr-electrum-servers"
        >
          {t('core:message.generic.pirate_chain_servers', {
            postProcess: 'capitalizeFirstChar',
          })}
        </DialogTitle>
        <DialogContent dividers>
          <Box
            sx={{
              width: '100%',
              maxWidth: 500,
              position: 'relative',
              overflow: 'auto',
              maxHeight: 400,
            }}
          >
            <List>
              {allLightwalletServersArrr.map(
                (
                  server: {
                    connectionType: string;
                    hostName: string;
                    port: number;
                  },
                  i: Key
                ) => (
                  <ListItemButton
                    key={i}
                    onClick={() => {
                      setNewArrrServer(
                        server?.connectionType,
                        server?.hostName,
                        server?.port
                      );
                    }}
                  >
                    <ListItemText
                      primary={
                        server?.connectionType +
                        '://' +
                        server?.hostName +
                        ':' +
                        server?.port
                      }
                      key={i}
                    />
                  </ListItemButton>
                )
              )}
            </List>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={handleCloseArrrServerChange}>
            {t('core:action.close', {
              postProcess: 'capitalizeFirstChar',
            })}
          </Button>
        </DialogActions>
      </LightwalletDialog>

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
                  alt="ARRR Logo"
                  src={coinLogoARRR}
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
                  {t('core:message.generic.pirate_chain_wallet', {
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
                  gridTemplateRows: { xs: 'repeat(4, auto)', md: '1fr 1fr' },
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
                  justifyContent={{ xs: 'center', md: 'flex-start' }}
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
                    {walletBalanceArrr ? (
                      `${walletBalanceArrr} ARRR`
                    ) : (
                      <LinearProgress />
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
                  <Box display={'flex'} alignItems={'center'} gap={1}>
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
                      {walletInfoArrr?.address}
                    </Typography>

                    <CustomWidthTooltip
                      placement="top"
                      title={t('core:action.copy_address', {
                        postProcess: 'capitalizeFirstChar',
                      })}
                    >
                      <IconButton
                        size="small"
                        onClick={() =>
                          copyToClipboard(
                            walletInfoArrr?.address ?? EMPTY_STRING
                          )
                        }
                      >
                        <CopyAllTwoTone fontSize="small" />
                      </IconButton>
                    </CustomWidthTooltip>
                  </Box>
                </Grid>

                <Grid
                  sx={{
                    gridColumn: { xs: '1 / span 2', md: '1 / span 2' },
                    gridRow: { xs: '3', md: '3' },
                    p: { xs: 1.5, md: 2 },
                  }}
                >
                  <Box display={'flex'} alignItems={'center'} gap={1}>
                    <Typography
                      variant="subtitle1"
                      align="center"
                      sx={{ color: 'primary.main', fontWeight: 700 }}
                    >
                      {t('core:message.generic.lightwallet_server', {
                        postProcess: 'capitalizeFirstChar',
                      })}
                    </Typography>
                    <Typography
                      variant="subtitle1"
                      align="center"
                      sx={{ color: 'text.primary', fontWeight: 700 }}
                    >
                      {currentLightwalletServerArrr[0]?.hostName ? (
                        currentLightwalletServerArrr[0]?.hostName +
                        ':' +
                        currentLightwalletServerArrr[0]?.port
                      ) : (
                        <Box sx={{ width: '175px' }}>
                          <LinearProgress />
                        </Box>
                      )}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle1">{syncStatus}</Typography>
                    {!isSynced && !isLoadingWalletBalanceArrr && (
                      <Button
                        variant="contained"
                        startIcon={<Send style={{ marginBottom: 2 }} />}
                        aria-label="Change Server"
                        onClick={handleRetry}
                      >
                        {t('core:action.retry', {
                          postProcess: 'capitalizeFirstChar',
                        })}
                      </Button>
                    )}
                  </Box>
                </Grid>

                <Grid
                  alignContent={'center'}
                  display={'flex'}
                  justifyContent={'center'}
                  sx={{
                    gridColumn: { xs: '1', md: '2' },
                    gridRow: { xs: '4', md: '1 / span 2' },
                    p: { xs: 1.5, md: 2 },
                  }}
                >
                  <Box
                    sx={{
                      alignItems: 'center',
                      aspectRatio: '1 / 1',
                      bgcolor: '#fff',
                      border: (t: any) => `1px solid ${t.palette.divider}`,
                      borderRadius: 1,
                      boxShadow: (t: any) => t.shadows[2],
                      display: 'flex',
                      height: '100%',
                      justifyContent: 'center',
                      maxHeight: { xs: 200, md: 150 },
                      maxWidth: { xs: 200, md: 150 },
                      p: 0.5,
                    }}
                  >
                    <QRCode
                      value={walletInfoArrr?.address ?? EMPTY_STRING}
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
                  onClick={handleOpenArrrSend}
                >
                  {t('core:action.transfer_coin', {
                    coin: Coin.ARRR,
                    postProcess: 'capitalizeFirstChar',
                  })}
                </WalletButtons>
                <WalletButtons
                  variant="contained"
                  startIcon={<Send style={{ marginBottom: 2 }} />}
                  aria-label="Change Server"
                  onClick={handleOpenArrrServerChange}
                >
                  {t('core:action.change_server', {
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
                  onClick={handleLoadingRefreshArrr}
                  loading={loadingRefreshArrr}
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

              {isLoadingArrrTransactions ? (
                <Box sx={{ width: '100%' }}>{ArrrTableLoader()}</Box>
              ) : (
                <Box sx={{ width: '100%' }}>{ArrrTransactionsTable()}</Box>
              )}
            </Box>
          </Grid>
        </Grid>
      </WalletCard>
    </Box>
  );
}
