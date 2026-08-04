import { useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import type { CreateProductInput } from '@shopnest/contracts'
import { useTranslation } from '@shopnest/i18n/react'
import { Alert, Button, Card, Icon, Modal } from '@shopnest/ui-web'
import {
  ProductForm,
  ProductVariantsCard,
  useArchiveProduct,
  useCreateProduct,
  useProduct,
  useUpdateProduct,
} from '@/features/products'
import { fakeTenant } from '@/lib/fake/fixtures'

/** Création — aucun identifiant dans l'URL. */
export function ProductCreatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const create = useCreateProduct()

  return (
    <div className="flex flex-col gap-lg">
      <BackLink />

      <header>
        <h1 className="text-xl font-semibold text-text-primary">{t('products.form.newTitle')}</h1>
        <p className="text-sm text-text-secondary">{t('products.form.newSubtitle')}</p>
      </header>

      <ProductForm
        currency={fakeTenant.defaultCurrency}
        submitting={create.isPending}
        error={create.error ?? undefined}
        onCancel={() => void navigate({ to: '/products' })}
        onSubmit={(values: CreateProductInput) =>
          create.mutate(values, {
            // On ouvre la fiche créée plutôt que de revenir à la liste :
            // l'utilisateur enchaîne souvent sur une seconde retouche.
            onSuccess: (product) =>
              void navigate({ to: '/products/$productId', params: { productId: product.id } }),
          })
        }
      />
    </div>
  )
}

/** Édition — la fiche est chargée avant d'afficher le formulaire. */
export function ProductEditPage() {
  const { t, date } = useTranslation()
  const navigate = useNavigate()
  const { productId } = useParams({ from: '/authenticated/products/$productId' })

  const query = useProduct(productId)
  const update = useUpdateProduct(productId)
  const archive = useArchiveProduct(productId)
  const [confirmArchive, setConfirmArchive] = useState(false)

  return (
    <div className="flex flex-col gap-lg">
      <BackLink />

      {query.isPending && <div className="h-96 animate-pulse rounded-lg bg-surface-sunken" />}

      {query.isError && (
        <Card>
          <div className="flex flex-col items-start gap-md">
            <Alert variant="danger">{t(query.error.userMessageKey)}</Alert>
            <Link to="/products">
              <Button variant="secondary">{t('products.form.back')}</Button>
            </Link>
          </div>
        </Card>
      )}

      {query.data && (
        <>
          <header className="flex flex-wrap items-start justify-between gap-md">
            <div>
              <h1 className="text-xl font-semibold text-text-primary">{query.data.name}</h1>
              <p className="text-sm text-text-secondary">
                {t('products.form.updatedAt', { date: date(query.data.updatedAt) })}
              </p>
            </div>

            {/* L'archivage n'est proposé que sur un produit encore au catalogue. */}
            {query.data.status !== 'archived' && (
              <Button variant="danger" onClick={() => setConfirmArchive(true)}>
                {t('products.form.archive')}
              </Button>
            )}
          </header>

          {query.data.status === 'archived' && (
            <Alert variant="warning" title={t('products.status.archived')}>
              {t('products.form.archivedHint')}
            </Alert>
          )}

          <ProductForm
            product={query.data}
            currency={query.data.price.currency}
            submitting={update.isPending}
            error={update.error ?? undefined}
            onCancel={() => void navigate({ to: '/products' })}
            onSubmit={(values) => update.mutate(values)}
          />

          {update.isSuccess && !update.isPending && (
            <Alert variant="success">{t('products.form.saved')}</Alert>
          )}

          <ProductVariantsCard product={query.data} />

          <Modal
            open={confirmArchive}
            onOpenChange={setConfirmArchive}
            title={t('products.form.archiveTitle')}
            description={t('products.form.archiveBody', { name: query.data.name })}
            footer={
              <>
                <Button variant="ghost" onClick={() => setConfirmArchive(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="danger"
                  loading={archive.isPending}
                  onClick={() =>
                    archive.mutate(undefined, {
                      onSuccess: () => {
                        setConfirmArchive(false)
                        void navigate({ to: '/products' })
                      },
                    })
                  }
                >
                  {t('products.form.archive')}
                </Button>
              </>
            }
          >
            {/*
              On explique POURQUOI c'est un archivage et pas une suppression :
              sans cette phrase, l'utilisateur cherchera le vrai bouton supprimer.
            */}
            <Alert variant="warning">{t('products.form.archiveExplanation')}</Alert>
          </Modal>
        </>
      )}
    </div>
  )
}

function BackLink() {
  const { t } = useTranslation()
  return (
    <div>
      <Link to="/products" className="text-sm text-brand-primary hover:underline">
        <Icon name="arrow-left" /> {t('products.form.back')}
      </Link>
    </div>
  )
}
