package hpe5gapp

import (
	"context"

	cmsv1 "hpe5g-operator/pkg/apis/cms/v1"

	corev1 "k8s.io/api/core/v1"
	templatev1 "github.com/openshift/api/template/v1" 
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/handler"
	logf "sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/manager"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
	"sigs.k8s.io/controller-runtime/pkg/source"
)

var log = logf.Log.WithName("controller_hpe5gapp")

/**
* USER ACTION REQUIRED: This is a scaffold file intended for the user to modify with their own Controller
* business logic.  Delete these comments after modifying this file.*
 */

// Add creates a new HPE5gApp Controller and adds it to the Manager. The Manager will set fields on the Controller
// and Start it when the Manager is Started.
func Add(mgr manager.Manager) error {
	return add(mgr, newReconciler(mgr))
}

// newReconciler returns a new reconcile.Reconciler
func newReconciler(mgr manager.Manager) reconcile.Reconciler {
	return &ReconcileHPE5gApp{client: mgr.GetClient(), scheme: mgr.GetScheme()}
}

// add adds a new Controller to mgr with r as the reconcile.Reconciler
func add(mgr manager.Manager, r reconcile.Reconciler) error {
	// Create a new controller
	c, err := controller.New("hpe5gapp-controller", mgr, controller.Options{Reconciler: r})
	if err != nil {
		return err
	}

	// Watch for changes to primary resource HPE5gApp
	err = c.Watch(&source.Kind{Type: &cmsv1.HPE5gApp{}}, &handler.EnqueueRequestForObject{})
	if err != nil {
		return err
	}

	// Watch for changes to secondary resource TemplateInstances and requeue the owner HPE5gApp
	templatev1.AddToScheme(mgr.GetScheme())
	err = c.Watch(&source.Kind{Type: &templatev1.TemplateInstance{}}, &handler.EnqueueRequestForOwner{
		IsController: true,
		OwnerType:    &cmsv1.HPE5gApp{},
	})
	if err != nil {
		return err
	}

	return nil
}

// blank assignment to verify that ReconcileHPE5gApp implements reconcile.Reconciler
var _ reconcile.Reconciler = &ReconcileHPE5gApp{}

// ReconcileHPE5gApp reconciles a HPE5gApp object
type ReconcileHPE5gApp struct {
	// This client, initialized using mgr.Client() above, is a split client
	// that reads objects from the cache and writes to the apiserver
	client client.Client
	scheme *runtime.Scheme
}

// Reconcile reads that state of the cluster for a HPE5gApp object and makes changes based on the state read
// and what is in the HPE5gApp.Spec
// TODO(user): Modify this Reconcile function to implement your Controller logic.  This example creates
// a Pod as an example
// Note:
// The Controller will requeue the Request to be processed again if the returned error is non-nil or
// Result.Requeue is true, otherwise upon completion it will remove the work from the queue.
func (r *ReconcileHPE5gApp) Reconcile(request reconcile.Request) (reconcile.Result, error) {
	reqLogger := log.WithValues("Request.Namespace", request.Namespace, "Request.Name", request.Name)
	reqLogger.Info("Reconciling HPE5gApp")

	// Fetch the HPE5gApp instance
	instance := &cmsv1.HPE5gApp{}
	err := r.client.Get(context.TODO(), request.NamespacedName, instance)
	if err != nil {
		if errors.IsNotFound(err) {
			// Request object not found, could have been deleted after reconcile request.
			// Owned objects are automatically garbage collected. For additional cleanup logic use finalizers.
			// Return and don't requeue
			return reconcile.Result{}, nil
		}
		// Error reading the object - requeue the request.
		return reconcile.Result{}, err
	}

	// Look for the template to instantiate
	reqLogger.Info("Checking template availability", "Template name", instance.Spec.TemplateName)
	templateSpec := &templatev1.Template{}
	if err = r.client.Get(context.TODO(), types.NamespacedName{Name: instance.Spec.TemplateName, Namespace: request.Namespace}, templateSpec); err != nil {
		reqLogger.Info("Template not available", "Name", instance.Spec.TemplateName, "Using template content", instance.Spec.TemplateContent)
		templateSpec = &instance.Spec.TemplateContent;
	}
	reqLogger.Info("Reconciling template instance", "Template name", instance.Spec.TemplateName)
	secret, templateInstance := newTemplateInstanceForCR(instance, templateSpec)
	// Set HPE5gApp instance as the owner and controller of both template instance and secret
	if err = controllerutil.SetControllerReference(instance, templateInstance, r.scheme); err != nil {
		return reconcile.Result{}, err
	}
	if err = controllerutil.SetControllerReference(instance, secret, r.scheme); err != nil {
		return reconcile.Result{}, err
	}
	// Status update function
	updateStatus := func(ready bool, feedback string){
		instance.Status.Feedback=feedback
		instance.Status.Ready=ready
		err := r.client.Status().Update(context.TODO(), instance)
		if err != nil {
			reqLogger.Info("Cannot update status", "Status", feedback, "Error", err)
		}
	}

	// Check if the template instance already exists
	err = r.client.Get(context.TODO(), types.NamespacedName{Name: templateInstance.Name, Namespace: templateInstance.Namespace}, templateInstance)
	if err != nil && errors.IsNotFound(err) {
		// Template instance does not exist - create it
		// Check if the secret already exists
		err = r.client.Get(context.TODO(), types.NamespacedName{Name: secret.Name, Namespace: secret.Namespace}, secret)
		if err != nil && errors.IsNotFound(err) {
			reqLogger.Info("Creating a new secret", "Name", secret.Name)
			err = r.client.Create(context.TODO(), secret)
			if err != nil {
				reqLogger.Info("Failed at creating", "Secret", secret.Name, "Error", err)
				return reconcile.Result{}, err
			}
		}
		reqLogger.Info("Creating the template instance", "Name", templateInstance.Name)
		err = r.client.Create(context.TODO(), templateInstance)
		if err != nil {
			reqLogger.Info("Failed at creating", "Template instance", templateInstance.Name, "Error", err)
			return reconcile.Result{}, err
		}
		updateStatus(false, "Template instantiation started")
		// In progress, requeue
		return reconcile.Result{Requeue: true}, nil
	} else if err != nil {
		reqLogger.Info("Cannot create", "Template instance", instance.Spec.TemplateName, "Error", err)
		return reconcile.Result{}, err
	}

	// Template instance already exists - check status
	reqLogger.Info("Skip reconcile: Template instance already exists, checking status", "templateInstance.Namespace", templateInstance.Namespace, "templateInstance.Name", templateInstance.Name)
	for _, cond := range templateInstance.Status.Conditions {
		updateStatus(cond.Type == templatev1.TemplateInstanceReady && cond.Status == corev1.ConditionTrue, cond.Reason+": "+cond.Message)
		if cond.Type == templatev1.TemplateInstanceInstantiateFailure && cond.Status == corev1.ConditionTrue {
		reqLogger.Info("Instantiation failure", "Template instance", instance.Spec.TemplateName, "Reason", cond.Reason, "Message", cond.Message)
		return reconcile.Result{}, err
		}
		if cond.Type == templatev1.TemplateInstanceReady && cond.Status == corev1.ConditionTrue {
		// Template instance already exists with ready status - don't requeue
		reqLogger.Info("Instantiation succeeded", "Template instance", instance.Spec.TemplateName, "Reason", cond.Reason, "Message", cond.Message)
		return reconcile.Result{}, nil
		}
		// In progress, requeue
		reqLogger.Info("Instantiation in progress", "Template instance", instance.Spec.TemplateName, "Reason", cond.Reason, "Message", cond.Message)
		return reconcile.Result{Requeue: true}, nil
	}
	return reconcile.Result{Requeue: true}, nil
}

// newTemplateInstanceForCR returns a template instance from the template parameter
func newTemplateInstanceForCR(cr *cmsv1.HPE5gApp, template *templatev1.Template) (*corev1.Secret, *templatev1.TemplateInstance){
	labels := map[string]string{
		"app": cr.Name,
	}
	secret := corev1.Secret{
                		ObjectMeta: metav1.ObjectMeta{
                        		Name: cr.Name+"-"+template.Name,
					Namespace: cr.Namespace,
                		},
                		StringData: map[string]string{
                        		"NAME": cr.Name+"-"+template.Name,
                		},
			}
	return &secret, &templatev1.TemplateInstance{
		ObjectMeta: metav1.ObjectMeta{
			Name:      cr.Name + "-"+template.Name,
			Namespace: cr.Namespace,
			Labels:    labels,
		},
		Spec: templatev1.TemplateInstanceSpec{
			Template: *template,
			Secret: &corev1.LocalObjectReference{
                                        Name: secret.Name,
                                },
		},
	}
}