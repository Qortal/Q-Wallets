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
  Slider,
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
import coinLogoRVN from '../../assets/rvn.png';
import { useTranslation } from 'react-i18next';
import {
  DECIMAL_ROUND_UP,
  EMPTY_STRING,
  RVN_FEE,
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

const rvnMarks = [
  {
    value: 1000,
    label: 'MIN',
  },
  {
    value: 1500,
    label: 'DEF',
  },
  {
    value: 10000,
    label: 'MAX',
  },
];

function valueTextRvn(value: number) {
  return `${value} SAT`;
}

export default function RavencoinWallet() {
  const { t } = useTranslation(['core']);
  const theme = useTheme();

  const [walletInfoRvn, setWalletInfoRvn] = useState<any>({});
  const [walletBalanceRvn, setWalletBalanceRvn] = useState<any>(0);
  const [_isLoadingWalletInfoRvn, setIsLoadingWalletInfoRvn] =
    useState<boolean>(true);
  const [isLoadingWalletBalanceRvn, setIsLoadingWalletBalanceRvn] =
    useState<boolean>(true);
  const [transactionsRvn, setTransactionsRvn] = useState<any>([]);
  const [isLoadingRvnTransactions, setIsLoadingRvnTransactions] =
    useState<boolean>(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [copyRvnTxHash, setCopyRvnTxHash] = useState(EMPTY_STRING);
  const [openRvnSend, setOpenRvnSend] = useState(false);
  const [rvnAmount, setRvnAmount] = useState<number>(0);
  const [rvnRecipient, setRvnRecipient] = useState(EMPTY_STRING);
  const [addressFormatError, setAddressFormatError] = useState(false);
  const [rvnFee, setRvnFee] = useState<number>(0);
  const [_walletInfoError, setWalletInfoError] = useState<string | null>(null);
  const [walletBalanceError, setWalletBalanceError] = useState<string | null>(
    null
  );
  const [loadingRefreshRvn, setLoadingRefreshRvn] = useState(false);
  const [openTxRvnSubmit, setOpenTxRvnSubmit] = useState(false);
  const [openSendRvnSuccess, setOpenSendRvnSuccess] = useState(false);
  const [openSendRvnError, setOpenSendRvnError] = useState(false);
  const [openRvnAddressBook, setOpenRvnAddressBook] = useState(false);

  const maxSendableRvnCoin = () => {
    // manage the correct round up
    const value = (walletBalanceRvn - (rvnFee * 1000) / 1e8)
      .toFixed(DECIMAL_ROUND_UP);
    const [integer, decimal = ''] = value.split('.');
    const truncated = decimal
      .substring(0, DECIMAL_ROUND_UP)
      .padEnd(DECIMAL_ROUND_UP, '0');
    let truncatedMaxSendableRvnCoin: number = parseFloat(
      `${integer}.${truncated}`
    );
    return truncatedMaxSendableRvnCoin;
  };

  const emptyRows =
    page > 0
      ? Math.max(0, (1 + page) * rowsPerPage - transactionsRvn.length)
      : 0;

  const handleOpenAddressBook = () => {
    setOpenRvnAddressBook(true);
  };

  const handleCloseAddressBook = () => {
    setOpenRvnAddressBook(false);
  };

  const handleSelectAddress = (address: string, _name: string) => {
    setRvnRecipient(address);
    setRvnAmount(0);
    setRvnFee(RVN_FEE);
    setOpenRvnAddressBook(false);
    setOpenRvnSend(true);
    setAddressFormatError(false);
    setWalletInfoError(null);
    setWalletBalanceError(null);
    setOpenSendRvnError(false);
  };

  const handleOpenRvnSend = () => {
    setRvnAmount(0);
    setRvnRecipient(EMPTY_STRING);
    setRvnFee(RVN_FEE);
    setOpenRvnSend(true);
    setAddressFormatError(false);
    setWalletInfoError(null);
    setWalletBalanceError(null);
    setOpenSendRvnError(false);
  };

  const disableCanSendRvn = () =>
    rvnAmount <= 0 || rvnRecipient === EMPTY_STRING || addressFormatError;

  const handleRecipientChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.value.trim();
    const pattern = /^(R[1-9A-HJ-NP-Za-km-z]{33})$/;

    setRvnRecipient(value);

    if (pattern.test(value) || value === EMPTY_STRING) {
      setAddressFormatError(false);
    } else {
      setAddressFormatError(true);
    }
  };

  const handleCloseRvnSend = () => {
    setRvnAmount(0);
    setRvnFee(0);
    setOpenRvnSend(false);
    setAddressFormatError(false);
    setWalletInfoError(null);
    setWalletBalanceError(null);
    setOpenSendRvnError(false);
  };

  const changeCopyRvnTxHash = async () => {
    setCopyRvnTxHash('Copied');
    await timeoutDelay(TIME_SECONDS_2);
    setCopyRvnTxHash(EMPTY_STRING);
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

  const handleChangeRvnFee = (_: Event, newValue: number | number[]) => {
    setRvnFee(newValue as number);
    setRvnAmount(0);
  };

  const handleCloseSendRvnSuccess = (
    _event?: SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSendRvnSuccess(false);
  };

  const handleCloseSendRvnError = (
    _event?: SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpenSendRvnError(false);
  };

  const getWalletInfoRvn = async () => {
    setIsLoadingWalletInfoRvn(true);
    try {
      setWalletInfoError(null);
      const response = await qortalRequest({
        action: 'GET_USER_WALLET',
        coin: Coin.RVN,
      });
      if (response?.error) {
        setWalletInfoRvn({});
        setWalletInfoError(
          typeof response.error === 'string'
            ? response.error
            : t('core:message.error.loading_address', {
                postProcess: 'capitalizeFirstChar',
              })
        );
      } else {
        setWalletInfoRvn(response);
        setWalletInfoError(null);
      }
    } catch (error: any) {
      setWalletInfoRvn({});
      setWalletInfoError(
        error?.message ? String(error.message) : String(error)
      );
      console.error('ERROR GET RVN WALLET INFO', error);
    } finally {
      setIsLoadingWalletInfoRvn(false);
    }
  };

  const getWalletBalanceRvn = async () => {
    try {
      setIsLoadingWalletBalanceRvn(true);

      const response = await qortalRequestWithTimeout(
        {
          action: 'GET_WALLET_BALANCE',
          coin: Coin.RVN,
        },
        TIME_MINUTES_5
      );
      if (!response?.error) {
        setWalletBalanceRvn(response);
      }
    } catch (error: any) {
      setWalletBalanceRvn(null);
      setWalletBalanceError(
        error?.message ? String(error.message) : String(error)
      );
      console.error('ERROR GET RVN BALANCE', error);
    } finally {
      setIsLoadingWalletBalanceRvn(false);
    }
  };

  const getTransactionsRvn = async () => {
    try {
      setIsLoadingRvnTransactions(true);
      const responseRvnTransactions = await qortalRequestWithTimeout(
        {
          action: 'GET_USER_WALLET_TRANSACTIONS',
          coin: Coin.RVN,
        },
        TIME_MINUTES_5
      );

      if (responseRvnTransactions?.error) {
        setTransactionsRvn([]);
      } else {
        setTransactionsRvn(responseRvnTransactions);
      }
    } catch (error: any) {
      setTransactionsRvn([]);
      console.error('ERROR GET RVN TRANSACTIONS', error);
    } finally {
      setIsLoadingRvnTransactions(false);
    }
  };

  useEffect(() => {
    let intervalId: any;
    (async () => {
      await Promise.all([
        getWalletInfoRvn(),
        getWalletBalanceRvn(),
        getTransactionsRvn(),
      ]);
      intervalId = setInterval(() => {
        getWalletBalanceRvn();
        getTransactionsRvn();
      }, TIME_MINUTES_3);
    })();
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const handleLoadingRefreshRvn = async () => {
    setLoadingRefreshRvn(true);
    await getTransactionsRvn();
    setLoadingRefreshRvn(false);
  };

  const handleSendMaxRvn = () => {
    if (maxSendableRvnCoin() <= 0) {
      setRvnAmount(0);
    } else {
      setRvnAmount(maxSendableRvnCoin());
    }
  };

  const sendRvnRequest = async () => {
    setOpenTxRvnSubmit(true);
    const rvnFeeCalculated = Number(rvnFee / 1e8).toFixed(DECIMAL_ROUND_UP);
    try {
      const sendRequest = await qortalRequest({
        action: 'SEND_COIN',
        coin: Coin.RVN,
        recipient: rvnRecipient,
        amount: rvnAmount,
        fee: rvnFeeCalculated,
      });
      if (!sendRequest?.error) {
        setRvnAmount(0);
        setRvnRecipient(EMPTY_STRING);
        setRvnFee(RVN_FEE);
        setOpenTxRvnSubmit(false);
        setOpenSendRvnSuccess(true);
        setIsLoadingWalletBalanceRvn(true);
        await timeoutDelay(TIME_SECONDS_3);
        await getTransactionsRvn();
      }
    } catch (error) {
      setRvnAmount(0);
      setRvnRecipient(EMPTY_STRING);
      setRvnFee(RVN_FEE);
      setOpenTxRvnSubmit(false);
      setOpenSendRvnError(true);
      setIsLoadingWalletBalanceRvn(true);
      await timeoutDelay(TIME_SECONDS_3);
      await getTransactionsRvn();
      console.error('ERROR SENDING RVN', error);
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
              ? transactionsRvn.slice(
                  page * rowsPerPage,
                  page * rowsPerPage + rowsPerPage
                )
              : transactionsRvn
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
                        copyRvnTxHash
                          ? copyRvnTxHash
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
                          changeCopyRvnTxHash();
                        }}
                      >
                        <CopyAllTwoTone fontSize="small" />
                      </IconButton>
                    </CustomWidthTooltip>
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
                count={transactionsRvn.length}
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
        open={openRvnSend}
        onClose={handleCloseRvnSend}
        slots={{ transition: Transition }}
      >
        <SubmitDialog fullWidth={true} maxWidth="xs" open={openTxRvnSubmit}>
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
          open={openSendRvnSuccess}
          autoHideDuration={TIME_SECONDS_4}
          slots={{ transition: SlideTransition }}
          onClose={handleCloseSendRvnSuccess}
        >
          <Alert
            onClose={handleCloseSendRvnSuccess}
            severity="success"
            variant="filled"
            sx={{ width: '100%' }}
          >
            {t('core:message.generic.sent_transaction', {
              coin: Coin.RVN,
              postProcess: 'capitalizeAll',
            })}
          </Alert>
        </Snackbar>
        <Snackbar
          open={openSendRvnError}
          autoHideDuration={TIME_SECONDS_4}
          onClose={handleCloseSendRvnError}
        >
          <Alert
            onClose={handleCloseSendRvnError}
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
              onClick={handleCloseRvnSend}
              aria-label="close"
            >
              <Close />
            </IconButton>
            <Avatar
              sx={{ width: 28, height: 28 }}
              alt="RVN Logo"
              src={coinLogoRVN}
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
                coin: Coin.RVN,
                postProcess: 'capitalizeFirstChar',
              })}
            </Typography>
            <Button
              disabled={disableCanSendRvn()}
              variant="contained"
              startIcon={<Send />}
              aria-label="send-rvn"
              onClick={sendRvnRequest}
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
          </Typography>
          <Typography
            variant="h5"
            align="center"
            gutterBottom
            sx={{ color: 'text.primary', fontWeight: 700 }}
          >
            {isLoadingWalletBalanceRvn ? (
              <Box sx={{ width: '175px' }}>
                <LinearProgress />
              </Box>
            ) : walletBalanceError ? (
              walletBalanceError
            ) : (
              walletBalanceRvn + ' RVN'
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
              const newMaxRvnAmount = parseFloat(
                (walletBalanceRvn - (rvnFee * 1000) / 1e8).toFixed(
                  DECIMAL_ROUND_UP
                )
              );
              if (newMaxRvnAmount < 0) {
                return Number(0.0) + ' RVN';
              } else {
                return newMaxRvnAmount + ' RVN';
              }
            })()}
          </Typography>
          <Box style={{ marginInlineStart: '15px' }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleSendMaxRvn}
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
            value={rvnAmount}
            allowNegative={false}
            customInput={TextField}
            valueIsNumericString
            variant="outlined"
            label="Amount (RVN)"
            fullWidth
            isAllowed={(values) => {
              const maxRvnCoin = walletBalanceRvn - (rvnFee * 1000) / 1e8;
              const { formattedValue, floatValue } = values;
              return (
                formattedValue === EMPTY_STRING ||
                (floatValue ?? 0) <= maxRvnCoin
              );
            }}
            onValueChange={(values) => {
              setRvnAmount(values.floatValue ?? 0);
            }}
            required
          />
          <TextField
            required
            label={t('core:receiver_address', {
              postProcess: 'capitalizeFirstChar',
            })}
            id="rvn-address"
            margin="normal"
            value={rvnRecipient}
            onChange={handleRecipientChange}
            error={addressFormatError}
            fullWidth
            helperText={
              addressFormatError
                ? t('core:message.error.ravencoin_address_invalid', {
                    postProcess: 'capitalizeFirstChar',
                  })
                : t('core:message.generic.ravencoin_address', {
                    postProcess: 'capitalizeFirstChar',
                  })
            }
          />
        </Box>
        <Box
          sx={{
            alignItems: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            mt: 2.5,
            mx: 'auto',
            width: '100%',
            maxWidth: 420,
            px: { xs: 2, sm: 1 },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexDirection: 'column',
              width: '100%',
            }}
          >
            <Typography id="rvn-fee-slider" gutterBottom>
              {t('core:message.generic.current_fee', {
                fee: rvnFee,
                postProcess: 'capitalizeFirstChar',
              })}
            </Typography>
            <Slider
              track={false}
              step={100}
              min={1000}
              max={10000}
              valueLabelDisplay="auto"
              aria-labelledby="rvn-fee-slider"
              getAriaValueText={valueTextRvn}
              defaultValue={1500}
              marks={rvnMarks}
              onChange={handleChangeRvnFee}
            />
            <Typography
              align="center"
              sx={{ fontWeight: 600, fontSize: '14px', marginTop: '15px' }}
            >
              {t('core:message.generic.low_fee_transation', {
                postProcess: 'capitalizeFirstChar',
              })}
            </Typography>
          </Box>
        </Box>
      </Dialog>

      <AddressBookDialog
        open={openRvnAddressBook}
        onClose={handleCloseAddressBook}
        coinType={Coin.RVN}
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
                  alt="RVN Logo"
                  src={coinLogoRVN}
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
                  {t('core:message.generic.ravencoin_wallet', {
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
                    {walletBalanceRvn ? (
                      `${walletBalanceRvn} RVN`
                    ) : isLoadingWalletBalanceRvn ? (
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
                      {walletInfoRvn?.address}
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
                            walletInfoRvn?.address ?? EMPTY_STRING
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
                      value={walletInfoRvn?.address ?? EMPTY_STRING}
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
                  onClick={handleOpenRvnSend}
                >
                  {t('core:action.transfer_coin', {
                    coin: Coin.RVN,
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
                  onClick={handleLoadingRefreshRvn}
                  loading={loadingRefreshRvn}
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

              {isLoadingRvnTransactions ? (
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
