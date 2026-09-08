import React, { useState } from 'react';
import {
  Avatar,
  Box,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import type { SelectChangeEvent } from '@mui/material/Select';
import {
  ContentCopy,
  Delete,
  Edit,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  PersonOutline,
  Star,
  StarBorder,
} from '@mui/icons-material';
import { Coin } from 'qapp-core';
import { useTranslation } from 'react-i18next';
import { NameText } from '../NameText';
import { AddressBookEntry } from '../../utils/Types';
import { copyToClipboard, cropString } from '../../common/functions';
import { EMPTY_STRING, TIME_SECONDS_2 } from '../../common/constants';
import {
  getAddressBookAvatarColor,
  getAddressBookAvatarSx,
} from './avatarPalette';

interface AddressBookTableProps {
  entries: AddressBookEntry[];
  onEdit: (entry: AddressBookEntry) => void;
  onDelete: (entry: AddressBookEntry) => void;
  onUse?: (entry: AddressBookEntry) => void;
  onToggleFavorite?: (entry: AddressBookEntry) => void;
  onReorder?: (sourceId: string, targetId: string) => void;
  page: number;
  rowsPerPage: number;
  onPageChange: (event: unknown, newPage: number) => void;
  onRowsPerPageChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const getInitial = (value: string) =>
  value.trim().charAt(0).toUpperCase() || '?';

const formatRange = (page: number, rowsPerPage: number, count: number) => {
  if (count === 0) return '0-0 of 0';
  const start = page * rowsPerPage + 1;
  const end = Math.min(count, (page + 1) * rowsPerPage);
  return `${start}-${end} of ${count}`;
};

const headerSx = {
  color: 'text.secondary',
  fontSize: { xs: 12, md: 11.8 },
  fontWeight: 700,
  letterSpacing: 0,
  lineHeight: 1,
  textTransform: 'uppercase',
} as const;

const cellTextSx = {
  display: 'block',
  fontSize: { xs: 14, md: 13 },
  fontWeight: 600,
  lineHeight: 1.12,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

const tableRowHoverSx = {
  overflow: 'hidden',
  position: 'relative',
  '&::before': {
    background: (t: Theme) =>
      t.palette.mode === 'dark'
        ? 'linear-gradient(90deg, rgba(24,189,242,0.07), rgba(24,189,242,0.025))'
        : 'linear-gradient(90deg, rgba(11,143,211,0.07), rgba(11,143,211,0.025))',
    content: '""',
    inset: 0,
    opacity: 0,
    pointerEvents: 'none',
    position: 'absolute',
    transition: 'opacity 520ms ease-out',
    zIndex: 0,
  },
  '&:hover::before': {
    opacity: 1,
    transitionDuration: '90ms',
  },
  '& > *': {
    position: 'relative',
    zIndex: 1,
  },
} as const;

export const AddressBookTable: React.FC<AddressBookTableProps> = ({
  entries,
  onEdit,
  onDelete,
  onUse,
  onToggleFavorite,
  onReorder,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
}) => {
  const { t } = useTranslation(['core']);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [suppressUseClick, setSuppressUseClick] = useState(false);
  const maxPage = Math.max(0, Math.ceil(entries.length / rowsPerPage) - 1);
  const paginatedEntries = entries.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleCopy = async (address: string, id: string) => {
    try {
      await copyToClipboard(address);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), TIME_SECONDS_2);
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  };

  const handleRowsPerPageSelect = (event: SelectChangeEvent<string>) => {
    onRowsPerPageChange?.({
      target: { value: event.target.value },
    } as React.ChangeEvent<HTMLInputElement>);
  };

  const handleUseEntry = (entry: AddressBookEntry) => {
    if (suppressUseClick) return;
    onUse?.(entry);
  };

  const handleUseKeyDown = (
    event: React.KeyboardEvent<HTMLElement>,
    entry: AddressBookEntry
  ) => {
    if (!onUse) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleUseEntry(entry);
    }
  };

  const handleDragStart = (
    event: React.DragEvent<HTMLElement>,
    entry: AddressBookEntry
  ) => {
    if (!onReorder) return;
    setDraggedId(entry.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', entry.id);
  };

  const handleDragOver = (
    event: React.DragEvent<HTMLElement>,
    entry: AddressBookEntry
  ) => {
    if (!onReorder || !draggedId || draggedId === entry.id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverId(entry.id);
  };

  const handleDrop = (
    event: React.DragEvent<HTMLElement>,
    entry: AddressBookEntry
  ) => {
    if (!onReorder) return;
    event.preventDefault();
    const sourceId = draggedId || event.dataTransfer.getData('text/plain');
    setDraggedId(null);
    setDragOverId(null);

    if (!sourceId || sourceId === entry.id) return;

    setSuppressUseClick(true);
    onReorder(sourceId, entry.id);
    window.setTimeout(() => setSuppressUseClick(false), 0);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const renderActions = (entry: AddressBookEntry) => (
    <Box
      sx={{
        alignItems: 'center',
        display: 'flex',
        gap: { xs: 0.45, md: 0.55 },
        justifyContent: 'flex-end',
      }}
    >
      {onToggleFavorite && (
        <Tooltip
          title={entry.favorite ? 'Remove favorite' : 'Favorite'}
          placement="top"
        >
          <IconButton
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite(entry);
            }}
            aria-label={entry.favorite ? 'Remove favorite' : 'Favorite'}
            sx={{
              color: entry.favorite ? '#f6c84c' : 'text.secondary',
              p: { xs: 0.45, md: 0.45 },
              '&:hover': {
                bgcolor: 'rgba(246,200,76,0.08)',
                color: '#ffd76a',
              },
            }}
          >
            {entry.favorite ? (
              <Star sx={{ fontSize: { xs: 19, md: 21 } }} />
            ) : (
              <StarBorder sx={{ fontSize: { xs: 19, md: 21 } }} />
            )}
          </IconButton>
        </Tooltip>
      )}
      <Tooltip
        title={t('core:address_book_edit', {
          postProcess: 'capitalizeFirstChar',
        })}
        placement="top"
      >
        <IconButton
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(entry);
          }}
          aria-label={t('core:address_book_edit', {
            postProcess: 'capitalizeFirstChar',
          })}
          sx={{
            color: 'text.secondary',
            p: { xs: 0.45, md: 0.45 },
            '&:hover': {
              bgcolor: 'rgba(24,189,242,0.08)',
              color: 'primary.main',
            },
          }}
        >
          <Edit sx={{ fontSize: { xs: 19, md: 21 } }} />
        </IconButton>
      </Tooltip>
      <Tooltip
        title={t('core:address_book_delete', {
          postProcess: 'capitalizeFirstChar',
        })}
        placement="top"
      >
        <IconButton
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(entry);
          }}
          aria-label={t('core:address_book_delete', {
            postProcess: 'capitalizeFirstChar',
          })}
          sx={{
            color: 'text.secondary',
            p: { xs: 0.45, md: 0.45 },
            '&:hover': {
              bgcolor: 'rgba(255,91,105,0.08)',
              color: 'error.main',
            },
          }}
        >
          <Delete sx={{ fontSize: { xs: 19, md: 21 } }} />
        </IconButton>
      </Tooltip>
    </Box>
  );

  const footer = (
    <Box
      sx={{
        alignItems: { xs: 'stretch', sm: 'center' },
        bgcolor: (t: Theme) =>
          t.palette.mode === 'dark'
            ? 'rgba(0,8,16,0.1)'
            : 'rgba(245,250,252,0.82)',
        borderTop: (t: Theme) =>
          t.palette.mode === 'dark'
            ? '1px solid rgba(116,158,180,0.075)'
            : '1px solid rgba(11,143,211,0.12)',
        display: 'grid',
        gap: { xs: 1.5, md: 1.2 },
        gridTemplateColumns: { xs: '1fr', md: '1fr auto auto' },
        minHeight: { xs: 88, md: 52 },
        px: { xs: 2, md: 1.4 },
      }}
    >
      <Box sx={{ alignItems: 'center', display: 'flex', gap: 0.8 }}>
        <PersonOutline
          sx={{ color: 'primary.main', fontSize: { xs: 24, md: 17 } }}
        />
        <Typography
          sx={{
            color: 'text.secondary',
            fontSize: { xs: 15, md: 13 },
            fontWeight: 600,
            letterSpacing: 0,
          }}
        >
          <Box
            component="span"
            sx={{ color: 'primary.main', fontWeight: 700, mr: 0.45 }}
          >
            {entries.length}
          </Box>
          {entries.length === 1 ? 'address' : 'addresses'}
        </Typography>
      </Box>

      <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
        <Typography
          sx={{
            color: 'text.secondary',
            fontSize: { xs: 14, md: 12.5 },
            fontWeight: 500,
            letterSpacing: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {t('core:rows_per_page', {
            postProcess: 'capitalizeFirstChar',
          })}
        </Typography>
        <Select
          value={String(rowsPerPage)}
          onChange={handleRowsPerPageSelect}
          sx={{
            bgcolor: (t: Theme) =>
              t.palette.mode === 'dark'
                ? 'rgba(0,8,16,0.24)'
                : 'rgba(255,255,255,0.78)',
            borderRadius: 1,
            color: 'text.primary',
            fontSize: { xs: 15, md: 13 },
            fontWeight: 700,
            height: { xs: 44, md: 34 },
            minWidth: { xs: 86, md: 62 },
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: (t: Theme) =>
                t.palette.mode === 'dark'
                  ? 'rgba(116,158,180,0.2)'
                  : 'rgba(11,143,211,0.2)',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(24,189,242,0.5)',
            },
            '& .MuiSelect-icon': {
              color: 'text.primary',
              fontSize: 22,
            },
          }}
        >
          {[5, 10, 15].map((value) => (
            <MenuItem key={value} value={String(value)}>
              {value}
            </MenuItem>
          ))}
        </Select>
      </Box>

      <Box
        sx={{
          alignItems: 'center',
          display: 'flex',
          gap: { xs: 1.3, md: 0.65 },
          justifyContent: { xs: 'space-between', md: 'flex-end' },
        }}
      >
        <Typography
          sx={{
            color: 'text.secondary',
            fontSize: { xs: 14, md: 12.5 },
            fontWeight: 500,
            minWidth: { md: 68 },
            whiteSpace: 'nowrap',
          }}
        >
          {formatRange(page, rowsPerPage, entries.length)}
        </Typography>
        <IconButton
          disabled={page <= 0}
          onClick={(event) => onPageChange(event, page - 1)}
          sx={{
            color: 'text.secondary',
            p: { xs: 0.5, md: 0.35 },
            '&:not(:disabled):hover': {
              bgcolor: 'rgba(24,189,242,0.09)',
              color: 'primary.main',
            },
          }}
        >
          <KeyboardArrowLeft sx={{ fontSize: { xs: 24, md: 21 } }} />
        </IconButton>
        <IconButton
          disabled={page >= maxPage}
          onClick={(event) => onPageChange(event, page + 1)}
          sx={{
            color: 'primary.main',
            p: { xs: 0.5, md: 0.35 },
            '&:disabled': { color: 'text.disabled' },
            '&:not(:disabled):hover': {
              bgcolor: 'rgba(24,189,242,0.09)',
            },
          }}
        >
          <KeyboardArrowRight sx={{ fontSize: { xs: 24, md: 21 } }} />
        </IconButton>
      </Box>
    </Box>
  );

  if (isMobile) {
    return (
      <Paper
        elevation={0}
        sx={{
          bgcolor: (t: Theme) =>
            t.palette.mode === 'dark'
              ? 'rgba(2,16,27,0.54)'
              : 'rgba(255,255,255,0.86)',
          backgroundImage: (t: Theme) =>
            t.palette.mode === 'dark'
              ? 'linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0.006))'
              : 'linear-gradient(180deg, rgba(255,255,255,0.72), rgba(246,250,252,0.88))',
          border: (t: Theme) =>
            t.palette.mode === 'dark'
              ? '1px solid rgba(116,158,180,0.085)'
              : '1px solid rgba(11,143,211,0.14)',
          borderRadius: 1.35,
          overflow: 'hidden',
        }}
      >
        <Box sx={{ display: 'grid' }}>
          {paginatedEntries.map((entry, index) => (
            <Box
              key={entry.id}
              draggable={Boolean(onReorder)}
              role={onUse ? 'button' : undefined}
              tabIndex={onUse ? 0 : undefined}
              onClick={onUse ? () => handleUseEntry(entry) : undefined}
              onDragStart={(event) => handleDragStart(event, entry)}
              onDragOver={(event) => handleDragOver(event, entry)}
              onDrop={(event) => handleDrop(event, entry)}
              onDragEnd={handleDragEnd}
              onKeyDown={
                onUse ? (event) => handleUseKeyDown(event, entry) : undefined
              }
              sx={{
                ...tableRowHoverSx,
                borderBottom:
                  index === paginatedEntries.length - 1
                    ? 'none'
                    : (t: Theme) =>
                        t.palette.mode === 'dark'
                          ? '1px solid rgba(116,158,180,0.075)'
                          : '1px solid rgba(11,143,211,0.11)',
                cursor: onReorder ? 'grab' : onUse ? 'pointer' : 'default',
                display: 'grid',
                gap: 1.1,
                opacity: draggedId === entry.id ? 0.52 : 1,
                p: 2,
                transition: 'background-color 150ms ease, opacity 150ms ease',
                ...(dragOverId === entry.id && {
                  bgcolor: 'rgba(24,189,242,0.08)',
                }),
                '&:focus-visible': {
                  outline: '1px solid rgba(24,189,242,0.48)',
                  outlineOffset: -1,
                },
              }}
            >
              <Box sx={{ alignItems: 'center', display: 'flex', gap: 1.2 }}>
                <Avatar
                  sx={{
                    ...getAddressBookAvatarSx(
                      getAddressBookAvatarColor(
                        `${entry.name}-${entry.address}`,
                        page * rowsPerPage + index
                      )
                    ),
                    fontSize: 16,
                    fontWeight: 800,
                    height: 42,
                    width: 42,
                  }}
                >
                  {getInitial(entry.name)}
                </Avatar>
                <NameText
                  name={entry.coinType === Coin.QORT ? entry.name : undefined}
                  fallback={entry.name || '-'}
                  sx={{ ...cellTextSx, color: 'text.primary' }}
                />
                {renderActions(entry)}
              </Box>
              <Box sx={{ alignItems: 'center', display: 'flex', gap: 0.65 }}>
                <Typography
                  sx={{
                    ...cellTextSx,
                    color: 'text.secondary',
                    fontWeight: 500,
                  }}
                >
                  {cropString(entry.address, 22)}
                </Typography>
                <Tooltip
                  title={
                    copiedId === entry.id
                      ? t('core:address_book_copied', {
                          postProcess: 'capitalizeFirstChar',
                        })
                      : t('core:address_book_copy', {
                          postProcess: 'capitalizeFirstChar',
                        })
                  }
                  placement="top"
                >
                  <IconButton
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCopy(entry.address, entry.id);
                    }}
                    sx={{
                      color:
                        copiedId === entry.id
                          ? 'success.main'
                          : 'text.secondary',
                      p: 0.35,
                    }}
                  >
                    <ContentCopy sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              </Box>
              <Typography
                sx={{
                  ...cellTextSx,
                  color: entry.note ? 'text.secondary' : 'text.disabled',
                  fontWeight: 500,
                }}
              >
                {entry.note || '-'}
              </Typography>
            </Box>
          ))}
        </Box>
        {footer}
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: (t: Theme) =>
          t.palette.mode === 'dark'
            ? 'rgba(2,16,27,0.54)'
            : 'rgba(255,255,255,0.86)',
        backgroundImage: (t: Theme) =>
          t.palette.mode === 'dark'
            ? 'linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0.006))'
            : 'linear-gradient(180deg, rgba(255,255,255,0.72), rgba(246,250,252,0.88))',
        border: (t: Theme) =>
          t.palette.mode === 'dark'
            ? '1px solid rgba(116,158,180,0.085)'
            : '1px solid rgba(11,143,211,0.14)',
        borderRadius: 1.35,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.018)',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ overflowX: 'auto', scrollbarGutter: 'stable' }}>
        <Box sx={{ minWidth: 730 }}>
          <Box
            aria-hidden
            sx={{
              alignItems: 'center',
              bgcolor: (t: Theme) =>
                t.palette.mode === 'dark'
                  ? 'rgba(0,8,16,0.08)'
                  : 'rgba(238,247,251,0.9)',
              borderBottom: (t: Theme) =>
                t.palette.mode === 'dark'
                  ? '1px solid rgba(116,158,180,0.075)'
                  : '1px solid rgba(11,143,211,0.12)',
              display: 'grid',
              gap: 1.2,
              gridTemplateColumns:
                'minmax(120px, 0.86fr) minmax(180px, 1fr) minmax(198px, 1.08fr) minmax(124px, 0.56fr)',
              minHeight: 44,
              px: 1.4,
            }}
          >
            <Typography sx={headerSx}>
              {t('core:address_book_name', {
                postProcess: 'capitalizeFirstChar',
              })}
            </Typography>
            <Typography sx={headerSx}>
              {t('core:address_book_address', {
                postProcess: 'capitalizeFirstChar',
              })}
            </Typography>
            <Typography sx={headerSx}>
              {t('core:address_book_note', {
                postProcess: 'capitalizeFirstChar',
              })}
            </Typography>
            <Typography sx={{ ...headerSx, textAlign: 'right' }}>
              {t('core:address_book_actions', {
                postProcess: 'capitalizeFirstChar',
              })}
            </Typography>
          </Box>

          {paginatedEntries.map((entry, index) => (
            <Box
              key={entry.id}
              draggable={Boolean(onReorder)}
              role={onUse ? 'button' : undefined}
              tabIndex={onUse ? 0 : undefined}
              onClick={onUse ? () => handleUseEntry(entry) : undefined}
              onDragStart={(event) => handleDragStart(event, entry)}
              onDragOver={(event) => handleDragOver(event, entry)}
              onDrop={(event) => handleDrop(event, entry)}
              onDragEnd={handleDragEnd}
              onKeyDown={
                onUse ? (event) => handleUseKeyDown(event, entry) : undefined
              }
              sx={{
                ...tableRowHoverSx,
                alignItems: 'center',
                borderBottom:
                  index === paginatedEntries.length - 1
                    ? 'none'
                    : (t: Theme) =>
                        t.palette.mode === 'dark'
                          ? '1px solid rgba(116,158,180,0.065)'
                          : '1px solid rgba(11,143,211,0.1)',
                cursor: onReorder ? 'grab' : onUse ? 'pointer' : 'default',
                display: 'grid',
                gap: 1.2,
                gridTemplateColumns:
                  'minmax(120px, 0.86fr) minmax(180px, 1fr) minmax(198px, 1.08fr) minmax(124px, 0.56fr)',
                minHeight: 54,
                opacity: draggedId === entry.id ? 0.52 : 1,
                px: 1.4,
                transition: 'background-color 150ms ease, opacity 150ms ease',
                ...(dragOverId === entry.id && {
                  bgcolor: 'rgba(24,189,242,0.08)',
                }),
                '&:focus-visible': {
                  outline: '1px solid rgba(24,189,242,0.48)',
                  outlineOffset: -1,
                },
              }}
            >
              <Box
                sx={{
                  alignItems: 'center',
                  display: 'flex',
                  gap: 0.85,
                  minWidth: 0,
                }}
              >
                <Avatar
                  sx={{
                    ...getAddressBookAvatarSx(
                      getAddressBookAvatarColor(
                        `${entry.name}-${entry.address}`,
                        page * rowsPerPage + index
                      )
                    ),
                    fontSize: 13,
                    fontWeight: 800,
                    height: 28,
                    width: 28,
                  }}
                >
                  {getInitial(entry.name)}
                </Avatar>
                <Tooltip title={entry.name || EMPTY_STRING} placement="top">
                  <NameText
                    name={entry.coinType === Coin.QORT ? entry.name : undefined}
                    fallback={entry.name || '-'}
                    sx={{ ...cellTextSx, color: 'text.primary' }}
                  />
                </Tooltip>
              </Box>

              <Box
                sx={{
                  alignItems: 'center',
                  display: 'flex',
                  gap: 1,
                  minWidth: 0,
                }}
              >
                <Tooltip title={entry.address} placement="top">
                  <Typography
                    sx={{
                      ...cellTextSx,
                      color: 'text.secondary',
                      fontWeight: 500,
                    }}
                  >
                    {cropString(entry.address, 24)}
                  </Typography>
                </Tooltip>
                <Tooltip
                  title={
                    copiedId === entry.id
                      ? t('core:address_book_copied', {
                          postProcess: 'capitalizeFirstChar',
                        })
                      : t('core:address_book_copy', {
                          postProcess: 'capitalizeFirstChar',
                        })
                  }
                  placement="top"
                >
                  <IconButton
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCopy(entry.address, entry.id);
                    }}
                    sx={{
                      color:
                        copiedId === entry.id
                          ? 'success.main'
                          : 'text.secondary',
                      flexShrink: 0,
                      p: 0.35,
                      '&:hover': { color: 'primary.main' },
                    }}
                  >
                    <ContentCopy sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              </Box>

              <Tooltip title={entry.note || EMPTY_STRING} placement="top">
                <Typography
                  sx={{
                    ...cellTextSx,
                    color: entry.note ? 'text.secondary' : 'text.disabled',
                    fontWeight: 500,
                  }}
                >
                  {entry.note ? cropString(entry.note, 34) : '-'}
                </Typography>
              </Tooltip>
              {renderActions(entry)}
            </Box>
          ))}
        </Box>
      </Box>
      {footer}
    </Paper>
  );
};
