import {
  ChangeEvent,
  Key,
  MouseEvent,
  SyntheticEvent,
  useEffect,
  useState,
} from 'react';
import {
  epochToAgo,
  timeoutDelay,
  cropString,
  copyToClipboard,
} from '../../common/functions';
import { useTheme } from '@mui/material/styles';
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
  Table,
  TableBody,
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
import TableCell from '@mui/material/TableCell';
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
  Refresh,
  Send,
} from '@mui/icons-material';
import coinLogoBTC from '../../assets/btc.png';
import { FeeManager } from '../../components/FeeManager';
import { useTranslation } from 'react-i18next';
import {
  BTC_FEE,
  DECIMAL_ROUND_UP,
  EMPTY_STRING,
  TIME_MINUTES_3,
  TIME_MINUTES_5,
  TIME_SECONDS_2,
  TIME_SECONDS_3,
  TIME_SECONDS_4,
} from '../../common/constants';
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
import { Coin } from 'qapp-core';
import { validateBtcAddress } from '../../utils/addressValidation';
import { AddressBookDialog } from '../../components/AddressBook/AddressBookDialog';

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

export default function BitcoinWallet() {
  const { t } = useTranslation(['core']);
  const theme = useTheme();

  const [walletInfoBtc, setWalletInfoBtc] = useState<any>({});
  const [_isLoadingWalletInfoBtc, setIsLoadingWalletInfoBtc] =
    useState<boolean>(false);
  const [walletBalanceBtc, setWalletBalanceBtc] = useState<any>(0);
  const [isLoadingWalletBalanceBtc, setIsLoadingWalletBalanceBtc] =
    useState<boolean>(true);
  const [transactionsBtc, setTransactionsBtc] = useState<any>([]);
  const [_isLoadingBtcTransactions, setIsLoadingBtcTransactions] =
    useState<boolean>(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [copyBtcTxHash, setCopyBtcTxHash] = useState(EMPTY_STRING);
  const [openBtcSend, setOpenBtcSend] = useState(false);
  const [btcAmount, setBtcAmount] = useState<number>(0);
  const [btcRecipient, setBtcRecipient] = useState(EMPTY_STRING);
  const [addressFormatError, setAddressFormatError] = useState(false);
  const [loadingRefreshBtc, setLoadingRefreshBtc] = useState(false);
  const [openTxBtcSubmit, setOpenTxBtcSubmit] = useState(false);
  const [openSendBtcSuccess, setOpenSendBtcSuccess] = useState(false);
  const [openSendBtcError, setOpenSendBtcError] = useState(false);
  const [openBtcAddressBook, setOpenBtcAddressBook] = useState(false);
  const [inputFee, setInputFee] = useState(0);
  const [_walletInfoError, setWalletInfoError] = useState<string | null>(null);
  const [walletBalanceError, setWalletBalanceError] = useState<string | null>(
    null
  );
  const btcFeeCalculated = +(+inputFee / 1000 / 1e8).toFixed(DECIMAL_ROUND_UP);
  const estimatedFeeCalculated = +btcFeeCalculated * BTC_FEE;

  const maxSendableBtcCoin = () => {
    // manage the correct round up
    const value = (walletBalanceBtc - estimatedFeeCalculated).toString();
    const [integer, decimal = ''] = value.split('.');
    const truncated = decimal
      .substring(0, DECIMAL_ROUND_UP)
      .padEnd(DECIMAL_ROUND_UP, '0');
    let truncatedMaxSendableBtcCoin: number = parseFloat(
      `${integer}.${truncated}`
    );
    return truncatedMaxSendableBtcCoin;
  };

  const emptyRows =
    page > 0
      ? Math.max(0, (1 + page) * rowsPerPage - transactionsBtc.length)
      : 0;

  const handleOpenAddressBook = () => {
    setOpenBtcAddressBook(true);
  };

  const handleCloseAddressBook = () => {
    setOpenBtcAddressBook(false);
  };

  const handleSelectAddress = (address: string, _name: string) => {
    setBtcRecipient(address);
    setBtcAmount(0);
    setOpenBtcAddressBook(false);
    setOpenBtcSend(true);
    setAddressFormatError(false);
    setOpenSendBtcError(false);
    setWalletBalanceError(null);
  };

  const handleOpenBtcSend = () => {
    setBtcAmount(0);
    setBtcRecipient(EMPTY_STRING);
    setOpenBtcSend(true);
    setAddressFormatError(false);
    setOpenSendBtcError(false);
    setWalletBalanceError(null);
  };

  const disableCanSendBtc = () =>
    btcAmount <= 0 || btcRecipient === EMPTY_STRING || addressFormatError;

  const handleRecipientChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.value.trim();
    setBtcRecipient(value);

    if (validateBtcAddress(value) || value === EMPTY_STRING) {
      setAddressFormatError(false);
    } else {
      setAddressFormatError(true);
    }
  };

  const handleCloseBtcSend = () => {
    setBtcAmount(0);
    setOpenBtcSend(false);
    setAddressFormatError(false);
    setOpenSendBtcError(false);
    setWalletBalanceError(null);
  };

  const changeCopyBtcTxHash = async () => {
    setCopyBtcTxHash('Copied');
    await timeoutDelay(TIME_SECONDS_2);
    setCopyBtcTxHash(EMPTY_STRING);
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

  const handleCloseSendBtcSuccess = (
    _event?: SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSendBtcSuccess(false);
  };

  const handleCloseSendBtcError = (
    _event?: SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSendBtcError(false);
  };

  const getWalletInfoBtc = async () => {
    setIsLoadingWalletInfoBtc(true);
    try {
      setWalletInfoError(null);
      const response = await qortalRequest({
        action: 'GET_USER_WALLET',
        coin: Coin.BTC,
      });
      if (response?.error) {
        setWalletInfoBtc({});
        setWalletInfoError(
          typeof response.error === 'string'
            ? response.error
            : t('core:message.error.loading_address', {
                postProcess: 'capitalizeFirstChar',
              })
        );
      } else {
        setWalletInfoBtc(response);
        setWalletInfoError(null);
      }
    } catch (error: any) {
      setWalletInfoBtc({});
      setWalletInfoError(
        error?.message ? String(error.message) : String(error)
      );
      console.error('ERROR GET BTC WALLET INFO', error);
    } finally {
      setIsLoadingWalletInfoBtc(false);
    }
  };

  useEffect(() => {
    let intervalId: any;
    (async () => {
      await Promise.all([
        getWalletInfoBtc(),
        getWalletBalanceBtc(),
        getTransactionsBtc(),
      ]);
      intervalId = setInterval(() => {
        getWalletBalanceBtc();
        getTransactionsBtc();
      }, TIME_MINUTES_3);
    })();
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const getWalletBalanceBtc = async () => {
    try {
      setIsLoadingWalletBalanceBtc(true);

      const response = await qortalRequestWithTimeout(
        {
          action: 'GET_WALLET_BALANCE',
          coin: Coin.BTC,
        },
        TIME_MINUTES_5
      );

      if (!response?.error) {
        setWalletBalanceBtc(response);
      }
    } catch (error: any) {
      setWalletBalanceBtc(null);
      setWalletBalanceError(
        error?.message ? String(error.message) : String(error)
      );
      console.error('ERROR GET BTC BALANCE', error);
    } finally {
      setIsLoadingWalletBalanceBtc(false);
    }
  };

  const getTransactionsBtc = async () => {
    try {
      setIsLoadingBtcTransactions(true);
      const responseBtcTransactions = await qortalRequestWithTimeout(
        {
          action: 'GET_USER_WALLET_TRANSACTIONS',
          coin: Coin.BTC,
        },
        TIME_MINUTES_5
      );

      if (responseBtcTransactions?.error) {
        setTransactionsBtc([]);
      } else {
        setTransactionsBtc(responseBtcTransactions);
      }
    } catch (error: any) {
      setTransactionsBtc([]);
      console.error('ERROR GET BTC TRANSACTIONS', error);
    } finally {
      setIsLoadingBtcTransactions(false);
    }
  };

  const handleLoadingRefreshBtc = async () => {
    setLoadingRefreshBtc(true);
    await getTransactionsBtc();
    setLoadingRefreshBtc(false);
  };

  const handleSendMaxBtc = () => {    
    if (maxSendableBtcCoin() <= 0) {
      setBtcAmount(0);
    } else {
      setBtcAmount(maxSendableBtcCoin());
    }
  };

  const sendBtcRequest = async () => {
    if (!btcFeeCalculated) return;
    setOpenTxBtcSubmit(true);
    try {
      const sendRequest = await qortalRequest({
        action: 'SEND_COIN',
        coin: Coin.BTC,
        recipient: btcRecipient,
        amount: btcAmount,
        fee: btcFeeCalculated,
      });
      if (!sendRequest?.error) {
        setBtcAmount(0);
        setBtcRecipient(EMPTY_STRING);
        setOpenTxBtcSubmit(false);
        setOpenSendBtcSuccess(true);
        setIsLoadingWalletBalanceBtc(true);
        await timeoutDelay(TIME_SECONDS_3);
        await getTransactionsBtc();
      }
    } catch (error) {
      setBtcAmount(0);
      setBtcRecipient(EMPTY_STRING);
      setOpenTxBtcSubmit(false);
      setOpenSendBtcError(true);
      setIsLoadingWalletBalanceBtc(true);
      await timeoutDelay(TIME_SECONDS_3);
      getTransactionsBtc();
      console.error('ERROR SENDING BTC', error);
    }
  };

  const tableLoader = () => {
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

  const transactionsTable = () => {
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
              ? transactionsBtc.slice(
                  page * rowsPerPage,
                  page * rowsPerPage + rowsPerPage
                )
              : transactionsBtc
            )?.map(
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
                          {input.address}
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
                          {output.address}
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
                        copyBtcTxHash
                          ? copyBtcTxHash
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
                          changeCopyBtcTxHash();
                        }}
                      >
                        <CopyAllTwoTone fontSize="small" />
                      </IconButton>
                    </CustomWidthTooltip>
                  </StyledTableCell>
                  <StyledTableCell style={{ width: 'auto' }} align="left">
                    {row?.totalAmount > 0 ? (
                      <Box sx={{ color: theme.palette.success.main }}>
                        +
                        {(Number(row?.totalAmount) / 1e8).toFixed(
                          DECIMAL_ROUND_UP
                        )}
                      </Box>
                    ) : (
                      <Box sx={{ color: theme.palette.error.main }}>
                        {(Number(row?.totalAmount) / 1e8).toFixed(
                          DECIMAL_ROUND_UP
                        )}
                      </Box>
                    )}
                  </StyledTableCell>
                  <StyledTableCell style={{ width: 'auto' }} align="right">
                    {row?.totalAmount <= 0 ? (
                      <Box sx={{ color: theme.palette.error.main }}>
                        -
                        {(Number(row?.feeAmount) / 1e8).toFixed(
                          DECIMAL_ROUND_UP
                        )}
                      </Box>
                    ) : (
                      <Box style={{ color: 'grey' }}>
                        -
                        {(Number(row?.feeAmount) / 1e8).toFixed(
                          DECIMAL_ROUND_UP
                        )}
                      </Box>
                    )}
                  </StyledTableCell>
                  <StyledTableCell style={{ width: 'auto' }} align="left">
                    <CustomWidthTooltip
                      placement="top"
                      title={
                        row?.timestamp
                          ? new Date(row?.timestamp).toLocaleString()
                          : t('core:message.generic.waiting_confirmation', {
                              postProcess: 'capitalizeFirstChar',
                            })
                      }
                    >
                      <Box>
                        {row?.timestamp
                          ? epochToAgo(row?.timestamp)
                          : t('core:message.generic.unconfirmed_transaction', {
                              postProcess: 'capitalizeFirstChar',
                            })}
                      </Box>
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
                count={transactionsBtc.length}
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
      <Dialog
        fullScreen
        open={openBtcSend}
        onClose={handleCloseBtcSend}
        slots={{ transition: Transition }}
      >
        <SubmitDialog fullWidth={true} maxWidth="xs" open={openTxBtcSubmit}>
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
          open={openSendBtcSuccess}
          autoHideDuration={TIME_SECONDS_4}
          slots={{ transition: SlideTransition }}
          onClose={handleCloseSendBtcSuccess}
        >
          <Alert
            onClose={handleCloseSendBtcSuccess}
            severity="success"
            variant="filled"
            sx={{ width: '100%' }}
          >
            {t('core:message.generic.sent_transaction', {
              coin: Coin.BTC,
              postProcess: 'capitalizeAll',
            })}
          </Alert>
        </Snackbar>
        <Snackbar
          open={openSendBtcError}
          autoHideDuration={TIME_SECONDS_4}
          onClose={handleCloseSendBtcError}
        >
          <Alert
            onClose={handleCloseSendBtcError}
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
              onClick={handleCloseBtcSend}
              aria-label="close"
            >
              <Close />
            </IconButton>
            <Avatar
              sx={{ width: 28, height: 28 }}
              alt="BTC Logo"
              src={coinLogoBTC}
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
                coin: Coin.BTC,
                postProcess: 'capitalizeFirstChar',
              })}
            </Typography>
            <Button
              disabled={disableCanSendBtc()}
              variant="contained"
              startIcon={<Send />}
              aria-label="send-btc"
              onClick={sendBtcRequest}
              sx={{
                backgroundColor: 'action.main',
                color: 'white',
                '&:hover': { backgroundColor: 'action.hover' },
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
            {isLoadingWalletBalanceBtc ? (
              <Box sx={{ width: '175px' }}>
                <LinearProgress />
              </Box>
            ) : walletBalanceError ? (
              walletBalanceError
            ) : (
              walletBalanceBtc + ' BTC'
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
              postProcess: 'capitalizeAll',
            })}
            &nbsp;&nbsp;
          </Typography>
          <Typography
            variant="h5"
            align="center"
            sx={{ color: 'text.primary', fontWeight: 700 }}
          >
            {(() => {
              const newMaxBtcAmount =
                +walletBalanceBtc - estimatedFeeCalculated;
              if (newMaxBtcAmount < 0) {
                return Number(0.0) + ' BTC';
              } else {
                return newMaxBtcAmount + ' BTC';
              }
            })()}
          </Typography>
          <Box style={{ marginInlineStart: '15px' }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleSendMaxBtc}
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
            value={btcAmount}
            allowNegative={false}
            customInput={TextField}
            valueIsNumericString
            variant="outlined"
            label="Amount (BTC)"
            fullWidth
            isAllowed={(values) => {
              const maxBtcCoin = +walletBalanceBtc - estimatedFeeCalculated;
              const { formattedValue, floatValue } = values;
              return (
                formattedValue === EMPTY_STRING ||
                (floatValue ?? 0) <= maxBtcCoin
              );
            }}
            onValueChange={(values) => {
              setBtcAmount(values.floatValue ?? 0);
            }}
            required
          />
          <TextField
            required
            label={t('core:receiver_address', {
              postProcess: 'capitalizeFirstChar',
            })}
            id="btc-address"
            margin="normal"
            value={btcRecipient}
            onChange={handleRecipientChange}
            error={addressFormatError}
            fullWidth
            helperText={
              addressFormatError
                ? t('core:message.error.bitcoin_address_invalid', {
                    postProcess: 'capitalizeFirstChar',
                  })
                : t('core:message.generic.bitcoin_address', {
                    postProcess: 'capitalizeFirstChar',
                  })
            }
          />
        </Box>
        <FeeManager coin="BTC" onChange={setInputFee} />
      </Dialog>

      <AddressBookDialog
        open={openBtcAddressBook}
        onClose={handleCloseAddressBook}
        coinType={Coin.BTC}
        onSelectAddress={handleSelectAddress}
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
              <Box sx={{ display: 'grid', alignItems: 'center' }}>
                <Box
                  component="img"
                  alt="BTC Logo"
                  src={coinLogoBTC}
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
                  {t('core:message.generic.bitcoin_wallet', {
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
                    {walletBalanceError
                      ? walletBalanceError
                      : walletBalanceBtc + ' BTC'}
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
                      {walletInfoBtc?.address}
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
                            walletInfoBtc?.address ?? EMPTY_STRING
                          )
                        }
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
                      height: '100%',
                      justifyContent: 'center',
                      maxHeight: { xs: 200, md: 150 },
                      maxWidth: { xs: 200, md: 150 },
                      p: 0.5,
                    }}
                  >
                    <QRCode
                      value={walletInfoBtc?.address ?? EMPTY_STRING}
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
                  onClick={handleOpenBtcSend}
                >
                  {t('core:action.transfer_coin', {
                    coin: Coin.BTC,
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
                  onClick={handleLoadingRefreshBtc}
                  loading={loadingRefreshBtc}
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

              {loadingRefreshBtc ? (
                <Box sx={{ width: '100%' }}>{tableLoader()}</Box>
              ) : (
                <Box sx={{ width: '100%' }}>{transactionsTable()}</Box>
              )}
            </Box>
          </Grid>
        </Grid>
      </WalletCard>
    </Box>
  );
}
