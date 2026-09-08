import React from 'react';
import {
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { DialogGeneral } from '../../styles/page-styles';

interface DeleteConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  entryName: string;
}

export const DeleteConfirmationDialog: React.FC<
  DeleteConfirmationDialogProps
> = ({ open, onClose, onConfirm, entryName }) => {
  const { t } = useTranslation(['core']);

  return (
    <DialogGeneral
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: (t: Theme) =>
              t.palette.mode === 'dark' ? 'rgba(3, 17, 29, 0.985)' : '#ffffff',
            backgroundImage: (t: Theme) =>
              t.palette.mode === 'dark'
                ? 'radial-gradient(circle at 13% 6%, rgba(24,189,242,0.13), transparent 30%), linear-gradient(180deg, rgba(5,24,39,0.99) 0%, rgba(3,13,23,0.995) 100%)'
                : 'radial-gradient(circle at 13% 6%, rgba(11,143,211,0.08), transparent 32%), linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(246,250,252,0.995) 100%)',
            border: (t: Theme) =>
              t.palette.mode === 'dark'
                ? '1px solid rgba(91,132,158,0.28)'
                : '1px solid rgba(11,143,211,0.16)',
            borderRadius: 2,
            boxShadow: (t: Theme) =>
              t.palette.mode === 'dark'
                ? '0 28px 72px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)'
                : '0 24px 70px rgba(15,74,106,0.18), inset 0 1px 0 rgba(255,255,255,0.9)',
            overflow: 'hidden',
            width: 'min(420px, calc(100vw - 24px))',
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          bgcolor: 'transparent',
          borderBottom: 'none',
          fontSize: 20,
          fontWeight: 700,
          lineHeight: 1.1,
          pb: 0.75,
          pt: 2.35,
          textAlign: 'center',
        }}
      >
        {t('core:address_book_delete', {
          postProcess: 'capitalizeFirstChar',
        })}
      </DialogTitle>
      <DialogContent sx={{ px: 3, pb: 1.5, pt: '10px !important' }}>
        <Typography
          sx={{
            color: 'text.secondary',
            fontSize: 14,
            fontWeight: 500,
            lineHeight: 1.45,
            textAlign: 'center',
          }}
        >
          {t('core:address_book_delete_confirm', {
            name: entryName,
            postProcess: 'capitalizeFirstChar',
          })}
        </Typography>
      </DialogContent>
      <DialogActions
        sx={{
          borderTop: (t: Theme) =>
            t.palette.mode === 'dark'
              ? '1px solid rgba(116,158,180,0.12)'
              : '1px solid rgba(11,143,211,0.12)',
          gap: 1.2,
          justifyContent: 'flex-end',
          px: 3,
          py: 1.6,
        }}
      >
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{
            borderColor: 'rgba(116,158,180,0.22)',
            borderRadius: 1.35,
            color: 'primary.main',
            fontWeight: 700,
            minHeight: 38,
            minWidth: 86,
            '&:hover': {
              bgcolor: 'rgba(116,158,180,0.08)',
              borderColor: 'rgba(116,158,180,0.38)',
            },
          }}
        >
          {t('core:address_book_cancel', {
            postProcess: 'capitalizeFirstChar',
          })}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          sx={{
            borderRadius: 1.35,
            fontWeight: 700,
            minHeight: 38,
            minWidth: 86,
            '&:hover': {
              backgroundColor: 'error.dark',
            },
          }}
        >
          {t('core:address_book_delete', {
            postProcess: 'capitalizeFirstChar',
          })}
        </Button>
      </DialogActions>
    </DialogGeneral>
  );
};
