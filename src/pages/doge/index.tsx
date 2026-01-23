import {
  ChangeEvent,
  Key,
  MouseEvent,
  SyntheticEvent,
  useEffect,
  useState,
} from 'react';
import { epochToAgo, timeoutDelay, cropString, copyToClipboard } from '../../common/functions';
import { AddressBookDialog } from '../../components/AddressBook/AddressBookDialog';
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
import coinLogoDOGE from '../../assets/doge.png';
import { useTranslation } from 'react-i18next';
import {
  DECIMAL_ROUND_UP,
  DOGE_FEE,
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
import { FeeManager } from '../../components/FeeManager';
import { Coin } from 'qapp-core';
import { validateDogeAddress } from '../../utils/addressValidation';

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

export default function DogecoinWallet() {
  const { t } = useTranslation(['core']);
  const theme = useTheme();

  const [walletInfoDoge, setWalletInfoDoge] = useState<any>({});
  const [walletBalanceDoge, setWalletBalanceDoge] = useState<any>(0);
  const [_isLoadingWalletInfoDoge, setIsLoadingWalletInfoDoge] =
    useState<boolean>(true);
  const [isLoadingWalletBalanceDoge, setIsLoadingWalletBalanceDoge] =
    useState<boolean>(true);
  const [transactionsDoge, setTransactionsDoge] = useState<any>([]);
  const [isLoadingDogeTransactions, setIsLoadingDogeTransactions] =
    useState<boolean>(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [copyDogeTxHash, setCopyDogeTxHash] = useState(EMPTY_STRING);
  const [openDogeSend, setOpenDogeSend] = useState(false);
  const [dogeAmount, setDogeAmount] = useState<number>(0);
  const [dogeRecipient, setDogeRecipient] = useState(EMPTY_STRING);
  const [addressFormatError, setAddressFormatError] = useState(false);
  const [loadingRefreshDoge, setLoadingRefreshDoge] = useState(false);
  const [openTxDogeSubmit, setOpenTxDogeSubmit] = useState(false);
  const [openSendDogeSuccess, setOpenSendDogeSuccess] = useState(false);
  const [openSendDogeError, setOpenSendDogeError] = useState(false);
  const [openDogeAddressBook, setOpenDogeAddressBook] = useState(false);

  const [inputFee, setInputFee] = useState(0);
  const [_walletInfoError, setWalletInfoError] = useState<string | null>(null);
  const [walletBalanceError, setWalletBalanceError] = useState<string | null>(
    null
  );

  const dogeFeeCalculated = +(+inputFee / 1000 / 1e8).toFixed(DECIMAL_ROUND_UP);
  const estimatedFeeCalculated = +dogeFeeCalculated * DOGE_FEE;

  const maxSendableDogeCoin = () => {
      // manage the correct round up
      const value = (walletBalanceDoge - estimatedFeeCalculated).toString();
      const [integer, decimal = ''] = value.split('.');
      const truncated = decimal.substring(0, DECIMAL_ROUND_UP).padEnd(DECIMAL_ROUND_UP, '0');
      let truncatedMaxSendableDogeCoin: number = parseFloat(`${integer}.${truncated}`);
      return truncatedMaxSendableDogeCoin;
    };

  const emptyRows =
    page > 0
      ? Math.max(0, (1 + page) * rowsPerPage - transactionsDoge.length)
      : 0;

  const handleOpenAddressBook = () => {
    setOpenDogeAddressBook(true);
  };

  const handleCloseAddressBook = () => {
    setOpenDogeAddressBook(false);
  };

  const handleSelectAddress = (address: string, _name: string) => {
    setDogeRecipient(address);
    setDogeAmount(0);
    setOpenDogeAddressBook(false);
    setOpenDogeSend(true);
    setAddressFormatError(false);
    setOpenSendDogeError(false);
  };

  const handleOpenDogeSend = () => {
    setDogeAmount(0);
    setDogeRecipient(EMPTY_STRING);
    setOpenDogeSend(true);
    setAddressFormatError(false);
    setOpenSendDogeError(false);
  };

  const disableCanSendDoge = () =>
    dogeAmount <= 0 || dogeRecipient === EMPTY_STRING || addressFormatError;

  const handleRecipientChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.value.trim();
    setDogeRecipient(value);

    if (validateDogeAddress(value) || value === EMPTY_STRING) {
      setAddressFormatError(false);
    } else {
      setAddressFormatError(true);
    }
  };

  const handleCloseDogeSend = () => {
    setDogeAmount(0);
    setOpenDogeSend(false);
    setAddressFormatError(false);
    setOpenSendDogeError(false);
  };

  const changeCopyDogeTxHash = async () => {
    setCopyDogeTxHash('Copied');
    await timeoutDelay(TIME_SECONDS_2);
    setCopyDogeTxHash(EMPTY_STRING);
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

  const handleCloseSendDogeSuccess = (
    _event?: SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSendDogeSuccess(false);
  };

  const handleCloseSendDogeError = (
    _event?: SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSendDogeError(false);
  };

  const getWalletInfoDoge = async () => {
    setIsLoadingWalletInfoDoge(true);
    try {
      setWalletInfoError(null);
      const response = await qortalRequest({
        action: 'GET_USER_WALLET',
        coin: Coin.DOGE,
      });
      if (response?.error) {
        setWalletInfoDoge({});
        setWalletInfoError(
          typeof response.error === 'string'
            ? response.error
            : t('core:message.error.loading_address', {
                postProcess: 'capitalizeFirstChar',
              })
        );
      } else {
        setWalletInfoDoge(response);
        setWalletInfoError(null);
      }
    } catch (error: any) {
      setWalletInfoDoge({});
      setWalletInfoError(
        error?.message ? String(error.message) : String(error)
      );
      console.error('ERROR GET DOGE WALLET INFO', error);
    } finally {
      setIsLoadingWalletInfoDoge(false);
    }
  };

  const getWalletBalanceDoge = async () => {
    try {
      setIsLoadingWalletBalanceDoge(true);

      const response = await qortalRequestWithTimeout(
        {
          action: 'GET_WALLET_BALANCE',
          coin: Coin.DOGE,
        },
        TIME_MINUTES_5
      );
      if (!response?.error) {
        setWalletBalanceDoge(response);
      }
    } catch (error: any) {
      setWalletBalanceDoge(null);
      setWalletBalanceError(
        error?.message ? String(error.message) : String(error)
      );
      console.error('ERROR GET DOGE BALANCE', error);
    } finally {
      setIsLoadingWalletBalanceDoge(false);
    }
  };

  const getTransactionsDoge = async () => {
    try {
      setIsLoadingDogeTransactions(true);
      const responseDogeTransactions = await qortalRequestWithTimeout(
        {
          action: 'GET_USER_WALLET_TRANSACTIONS',
          coin: Coin.DOGE,
        },
        TIME_MINUTES_5
      );

      if (responseDogeTransactions?.error) {
        setTransactionsDoge([]);
        setWalletBalanceDoge(null);
      } else {
        setTransactionsDoge(responseDogeTransactions);
      }
    } catch (error: any) {
      setTransactionsDoge([]);
      console.error('ERROR GET DOGE TRANSACTIONS', error);
    } finally {
      setIsLoadingDogeTransactions(false);
    }
  };

  useEffect(() => {
    let intervalId: any;
    (async () => {
      await Promise.all([
        getWalletInfoDoge(),
        getWalletBalanceDoge(),
        getTransactionsDoge(),
      ]);
      intervalId = setInterval(() => {
        getWalletBalanceDoge();
        getTransactionsDoge();
      }, TIME_MINUTES_3);
    })();
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const handleLoadingRefreshDoge = async () => {
    setLoadingRefreshDoge(true);
    await getTransactionsDoge();
    setLoadingRefreshDoge(false);
  };

  const handleSendMaxDoge = () => {        
    if (maxSendableDogeCoin() <= 0) {
      setDogeAmount(0);
    } else {
      setDogeAmount(maxSendableDogeCoin());
    }
  };

  const sendDogeRequest = async () => {
    if (!dogeFeeCalculated) return;

    setOpenTxDogeSubmit(true);
    try {
      const sendRequest = await qortalRequest({
        action: 'SEND_COIN',
        coin: Coin.DOGE,
        recipient: dogeRecipient,
        amount: dogeAmount,
        fee: dogeFeeCalculated,
      });
      if (!sendRequest?.error) {
        setDogeAmount(0);
        setDogeRecipient(EMPTY_STRING);
        setOpenTxDogeSubmit(false);
        setOpenSendDogeSuccess(true);
        setIsLoadingWalletBalanceDoge(true);
        await timeoutDelay(TIME_SECONDS_3);
        await getTransactionsDoge();
      }
    } catch (error) {
      setDogeAmount(0);
      setDogeRecipient(EMPTY_STRING);
      setOpenTxDogeSubmit(false);
      setOpenSendDogeError(true);
      setIsLoadingWalletBalanceDoge(true);
      await timeoutDelay(TIME_SECONDS_3);
      await getTransactionsDoge();
      console.error('ERROR SENDING DOGE', error);
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
              ? transactionsDoge.slice(
                  page * rowsPerPage,
                  page * rowsPerPage + rowsPerPage
                )
              : transactionsDoge
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
                          {(Number(input.amount) / 1e8).toFixed(DECIMAL_ROUND_UP)}
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
                          {(Number(output.amount) / 1e8).toFixed(DECIMAL_ROUND_UP)}
                        </span>
                      </Box>
                    ))}
                  </StyledTableCell>
                  <StyledTableCell style={{ width: 'auto' }} align="left">
                    {cropString(row?.txHash)}
                    <CustomWidthTooltip
                      placement="top"
                      title={
                        copyDogeTxHash
                          ? copyDogeTxHash
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
                          changeCopyDogeTxHash();
                        }}
                      >
                        <CopyAllTwoTone fontSize="small" />
                      </IconButton>
                    </CustomWidthTooltip>
                  </StyledTableCell>
                  <StyledTableCell style={{ width: 'auto' }} align="left">
                    {row?.totalAmount > 0 ? (
                      <Box style={{ color: theme.palette.success.main }}>
                        +{(Number(row?.totalAmount) / 1e8).toFixed(DECIMAL_ROUND_UP)}
                      </Box>
                    ) : (
                      <Box style={{ color: theme.palette.error.main }}>
                        {(Number(row?.totalAmount) / 1e8).toFixed(DECIMAL_ROUND_UP)}
                      </Box>
                    )}
                  </StyledTableCell>
                  <StyledTableCell style={{ width: 'auto' }} align="right">
                    {row?.totalAmount <= 0 ? (
                      <Box style={{ color: theme.palette.error.main }}>
                        -{(Number(row?.feeAmount) / 1e8).toFixed(DECIMAL_ROUND_UP)}
                      </Box>
                    ) : (
                      <Box style={{ color: 'grey' }}>
                        -{(Number(row?.feeAmount) / 1e8).toFixed(DECIMAL_ROUND_UP)}
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
                count={transactionsDoge.length}
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
        open={openDogeSend}
        onClose={handleCloseDogeSend}
        slots={{ transition: Transition }}
      >
        <SubmitDialog fullWidth={true} maxWidth="xs" open={openTxDogeSubmit}>
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
          open={openSendDogeSuccess}
          autoHideDuration={TIME_SECONDS_4}
          slots={{ transition: SlideTransition }}
          onClose={handleCloseSendDogeSuccess}
        >
          <Alert
            onClose={handleCloseSendDogeSuccess}
            severity="success"
            variant="filled"
            sx={{ width: '100%' }}
          >
            {t('core:message.generic.sent_transaction', {
              coin: Coin.DOGE,
              postProcess: 'capitalizeAll',
            })}
          </Alert>
        </Snackbar>
        <Snackbar
          open={openSendDogeError}
          autoHideDuration={TIME_SECONDS_4}
          onClose={handleCloseSendDogeError}
        >
          <Alert
            onClose={handleCloseSendDogeError}
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
              onClick={handleCloseDogeSend}
              aria-label="close"
            >
              <Close />
            </IconButton>
            <Avatar
              sx={{ width: 28, height: 28 }}
              alt="DOGE Logo"
              src={coinLogoDOGE}
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
                coin: Coin.DOGE,
                postProcess: 'capitalizeFirstChar',
              })}
            </Typography>
            <Button
              disabled={disableCanSendDoge()}
              variant="contained"
              startIcon={<Send />}
              aria-label="send-doge"
              onClick={sendDogeRequest}
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
            {isLoadingWalletBalanceDoge ? (
              <Box sx={{ width: '175px' }}>
                <LinearProgress />
              </Box>
            ) : walletBalanceError ? (
              walletBalanceError
            ) : (
              walletBalanceDoge + ' DOGE'
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
              const newMaxDogeAmount =
                +walletBalanceDoge - estimatedFeeCalculated;
              if (newMaxDogeAmount < 0) {
                return Number(0.0) + ' DOGE';
              } else {
                return newMaxDogeAmount + ' DOGE';
              }
            })()}
          </Typography>
          <Box style={{ marginInlineStart: '15px' }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleSendMaxDoge}
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
            value={dogeAmount}
            allowNegative={false}
            customInput={TextField}
            valueIsNumericString
            variant="outlined"
            label="Amount (DOGE)"
            fullWidth
            isAllowed={(values) => {
              const maxDogeCoin = +walletBalanceDoge - estimatedFeeCalculated;
              const { formattedValue, floatValue } = values;
              return (
                formattedValue === EMPTY_STRING ||
                (floatValue ?? 0) <= maxDogeCoin
              );
            }}
            onValueChange={(values) => {
              setDogeAmount(values.floatValue ?? 0);
            }}
            required
          />

          <TextField
            required
            label={t('core:receiver_address', {
              postProcess: 'capitalizeFirstChar',
            })}
            id="doge-address"
            margin="normal"
            value={dogeRecipient}
            onChange={handleRecipientChange}
            error={addressFormatError}
            fullWidth
            helperText={
              addressFormatError
                ? t('core:message.error.doge_address_invalid', {
                    postProcess: 'capitalizeFirstChar',
                  })
                : t('core:message.generic.doge_address', {
                    postProcess: 'capitalizeFirstChar',
                  })
            }
          />
        </Box>
        <FeeManager coin="DOGE" onChange={setInputFee} />
      </Dialog>

      <AddressBookDialog
        open={openDogeAddressBook}
        onClose={handleCloseAddressBook}
        coinType={Coin.DOGE}
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
                  alt="DOGE Logo"
                  src={coinLogoDOGE}
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
                  {t('core:message.generic.dogecoin_wallet', {
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
                    {walletBalanceDoge ? (
                      `${walletBalanceDoge} DOGE`
                    ) : isLoadingWalletBalanceDoge ? (
                      <LinearProgress />
                    ) : undefined}
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
                      {walletInfoDoge?.address}
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
                            walletInfoDoge?.address ?? EMPTY_STRING
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
                      value={walletInfoDoge?.address ?? EMPTY_STRING}
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
                  onClick={handleOpenDogeSend}
                >
                  {t('core:action.transfer_coin', {
                    coin: Coin.DOGE,
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
                  onClick={handleLoadingRefreshDoge}
                  loading={loadingRefreshDoge}
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

              {isLoadingDogeTransactions ? (
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
